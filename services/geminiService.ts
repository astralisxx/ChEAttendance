import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, AnalysisMode, QualityCheckResult, StudentProfile, Gender } from "../types";

// Helper to strip data URL prefix and get mime type
const parseBase64 = (base64String: string) => {
  const match = base64String.match(/^data:(.*);base64,(.*)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2]
    };
  }
  return {
    mimeType: 'image/jpeg',
    data: base64String
  };
};

const qualitySchema = {
  type: Type.OBJECT,
  properties: {
    passable: { 
      type: Type.BOOLEAN, 
      description: "True if the images are of sufficient quality for analysis, False if they are too blurry/dark/far." 
    },
    score: {
      type: Type.NUMBER,
      description: "A quality score from 0 to 100, where 100 is perfect 4K lighting and focus, and 0 is black/unusable.",
    },
    issues: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "A list of specific issues found (e.g., 'Reference photo is too blurry', 'Daily photo is underexposed')." 
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief explanation of the score."
    }
  },
  required: ["passable", "score", "issues", "reasoning"]
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    referenceCount: {
      type: Type.NUMBER,
      description: "The estimated number of people/objects counted in the reference image.",
    },
    dailyCount: {
      type: Type.NUMBER,
      description: "The estimated number of people/objects counted in the daily image.",
    },
    missingCount: {
      type: Type.NUMBER,
      description: "The number of items missing in Image 2 compared to Image 1.",
    },
    extraCount: {
      type: Type.NUMBER,
      description: "The number of NEW items found in Image 2 that were not in Image 1.",
    },
    attendanceRate: {
      type: Type.NUMBER,
      description: "Percentage of attendance based on reference count (0-100).",
    },
    matchMethod: {
      type: Type.STRING,
      enum: ["biometric", "contextual"],
      description: "Whether the AI used strict feature matching (biometric) or clothing/pattern matching (contextual)."
    },
    confidenceScore: {
      type: Type.NUMBER,
      description: "A score from 0-100 indicating how confident the AI is in the match."
    },
    missingPeople: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: "Visual description of the missing item based on the Reference Photo."
          },
          name: {
            type: Type.STRING,
            description: "The inferred name of the missing item if a roster was provided."
          },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Bounding box of this person in the REFERENCE image. Format: [ymin, xmin, ymax, xmax] (normalized 0-1)."
          }
        },
        required: ["description", "box_2d"]
      },
      description: "List of people present in Reference but absent in Daily.",
    },
    extraPeople: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: "Visual description of the new person based on the Daily Photo."
          },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Bounding box of this person in the DAILY image. Format: [ymin, xmin, ymax, xmax] (normalized 0-1)."
          },
          gender: {
            type: Type.STRING,
            enum: ["Male", "Female", "Unknown"],
            description: "The inferred gender of the new person based on visual assessment."
          }
        },
        required: ["description", "box_2d", "gender"]
      },
      description: "List of people present in Daily but absent in Reference (New Students).",
    },
    notes: {
      type: Type.STRING,
      description: "General observations about the match confidence.",
    },
  },
  required: ["referenceCount", "dailyCount", "missingCount", "extraCount", "attendanceRate", "missingPeople", "extraPeople", "notes"],
};

// --- RETRY HELPER ---
const generateWithRetry = async (ai: GoogleGenAI, params: any, retries = 3, baseDelay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const msg = (error.message || error.toString()).toLowerCase();
      
      if (msg.includes('429') || msg.includes('503') || msg.includes('quota') || msg.includes('overloaded') || msg.includes('resource_exhausted')) {
        const waitTime = baseDelay * Math.pow(2, i);
        console.warn(`Gemini API busy (Attempt ${i + 1}/${retries}). Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw error;
    }
  }
  throw lastError;
};

export const extractRosterNames = async (input: string, mimeType: string = 'image/jpeg'): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("Missing API Key.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let contentParts: any[] = [];

  if (mimeType === 'text/plain') {
    const prompt = `Analyze the following text which contains a list of student names. Text Content: "${input.slice(0, 100000)}" Task: Identify all student names. Return ONLY the names separated by commas. Remove headers/metadata.`;
    contentParts = [{ text: prompt }];
  } else {
    const data = input.includes('base64,') ? input.split('base64,')[1] : input;
    const prompt = `Analyze this document/image. Task: Read the list of student names. Return ONLY the names separated by commas. Maintain order.`;
    contentParts = [{ text: prompt }, { inlineData: { mimeType, data } }];
  }

  try {
    const response = await generateWithRetry(ai, { model: "gemini-3-flash-preview", contents: { parts: contentParts } });
    return response.text || "";
  } catch (error) {
    console.error("Roster extraction failed:", error);
    throw new Error("Could not extract names. Please ensure the file is readable.");
  }
};

export const checkImageQuality = async (refImg: string, dailyImg: string): Promise<QualityCheckResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const refImage = parseBase64(refImg);
  const dailyImage = parseBase64(dailyImg);

  const prompt = `You are a computer vision quality assurance expert. Analyze these two images (Reference and Daily) to determine if they are clear enough for an attendance check system. Evaluate: Sharpness, Lighting, Resolution. SCORING RUBRIC (Be Objective): 90-100: Excellent. Sharp focus, perfect lighting, high resolution. All faces clear. 75-89: Good. Minor grain or slight lighting issues. Faces identifiable. 60-74: Fair. Visible blur, shadows, or low resolution. Analysis possible but might miss details. 0-59: Poor. Severe blur, darkness, or pixelation. Faces unrecognizable. Output JSON with score (0-100), passable (bool), issues (array), reasoning (string).`;

  try {
    const response = await generateWithRetry(ai, {
      model: "gemini-3-flash-preview", 
      contents: { parts: [{ text: prompt }, { inlineData: { mimeType: refImage.mimeType, data: refImage.data } }, { inlineData: { mimeType: dailyImage.mimeType, data: dailyImage.data } }] },
      config: { responseMimeType: "application/json", responseSchema: qualitySchema, temperature: 0.0 },
    });
    if (!response.text) return { passable: false, score: 0, issues: ["No response"], reasoning: "Service failed." };
    return JSON.parse(response.text) as QualityCheckResult;
  } catch (error) {
    return { passable: true, score: 50, issues: ["Quality check unavailable"], reasoning: "Could not verify quality." }; 
  }
};

export const analyzeAttendance = async (
  referenceImageBase64: string,
  dailyImageBase64: string,
  studentNames?: string,
  mode: AnalysisMode = 'biometric',
  studentProfiles: StudentProfile[] = []
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("Missing API Key configuration.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const refImage = parseBase64(referenceImageBase64);
  const dailyImage = parseBase64(dailyImageBase64);

  let nameContext = studentNames ? `USER PROVIDED ROSTER (For Reference Image): "${studentNames}"\nTry to map these names to the subjects in Image 1 based on logical visual ordering.` : "";
  let strategyPrompt = mode === 'biometric' ? `MODE: BIOMETRIC / HIGH-FIDELITY\n- Strict identity verification using facial biometrics.` : `MODE: CROWD / CONTEXTUAL\n- Contextual Pattern Matching for groups/low-res.`;
  
  let profileContext = "";
  let profileParts: any[] = [];
  if (studentProfiles.length > 0) {
    profileContext = `KNOWN STUDENT PROFILES: You have been provided with ${studentProfiles.length} additional image crops of known students. Use these profiles, in addition to the main reference photo, to identify people in the daily photo. A person is NOT missing if they appear in the daily photo, even if they were identified from a profile instead of the reference photo. A person is NOT new if they match one of these profiles.`;
    profileParts = studentProfiles.flatMap(p => [
        { text: `Profile for ${p.name}:` },
        { inlineData: parseBase64(p.imageCrop) }
    ]);
  }

  const prompt = `You are an expert visual attendance assistant.
    Image 1: REFERENCE Photo (Master).
    Image 2: TODAY'S Photo.
    
    ${strategyPrompt}
    ${nameContext}
    ${profileContext}

    **CRITICAL TASK: DETECT ATTENDANCE & NEW ARRIVALS**
    Step 1: HEAD COUNT VERIFICATION. Count people in both images.
    Step 2: IDENTITY MAPPING. Map every person from Image 1 and KNOWN PROFILES to Image 2.
    Step 3: REPORT DISCREPANCIES.
    - Missing People: Present in Image 1, absent in Image 2. (Provide box_2d for REFERENCE image).
    - New/Extra People: Present in Image 2, absent in Image 1 AND all known profiles. (Provide box_2d for TODAY image, and infer gender).
    
    Output JSON matching the schema.
  `;

  try {
    const response = await generateWithRetry(ai, {
      model: "gemini-3-pro-preview", 
      contents: { parts: [{ text: prompt }, { inlineData: refImage }, { inlineData: dailyImage }, ...profileParts] },
      config: { responseMimeType: "application/json", responseSchema: analysisSchema, thinkingConfig: { thinkingBudget: 4096 } },
    }, 3, 2000);

    if (!response.text) throw new Error("Empty response from AI analysis.");
    return JSON.parse(response.text) as AnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    let userMessage = "An error occurred during analysis.";
    if (error.message.toLowerCase().includes("api key")) userMessage = "Invalid API Key configuration.";
    else if (error.message.toLowerCase().includes("safety")) userMessage = "Safety filters triggered. Please ensure photos are appropriate.";
    throw new Error(userMessage);
  }
};

export const getGenderForNames = async (names: string[]): Promise<Record<string, Gender>> => {
  if (!process.env.API_KEY || names.length === 0) return {};
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `For each name in this list, infer its most common gender (Male, Female, or Unknown). Names: ${names.join(', ')}. Return a JSON object mapping each name to its gender. Example: {"John": "Male", "Alex": "Unknown"}`;
  
  try {
    const response = await generateWithRetry(ai, {
      model: "gemini-3-flash-preview", 
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    if (!response.text) return {};
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gender inference failed:", error);
    return {};
  }
};
