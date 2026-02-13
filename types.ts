

export interface MissingPerson {
  description: string;
  name?: string;
  box_2d?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1
}

export type Gender = 'Male' | 'Female' | 'Unknown';

export interface ExtraPerson {
  description: string;
  box_2d?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1 (In DAILY image)
  gender?: Gender;
}

export interface UnidentifiedPerson extends ExtraPerson {
  // Inherits from ExtraPerson, can be used for more specific typing if needed
}

export interface AnalysisResult {
  referenceCount: number;
  dailyCount: number;
  missingCount: number;
  extraCount: number; 
  attendanceRate: number;
  missingPeople: MissingPerson[];
  extraPeople: ExtraPerson[];
  notes: string;
  matchMethod?: 'biometric' | 'contextual';
  confidenceScore?: number;
}

export interface HistoryRecord extends AnalysisResult {
  id: number; // Unique timestamp
  date: string; // ISO string
  studentRoster: string[];
}

export interface ImageUploadProps {
  title: string;
  description: string;
  image: string | null;
  onImageUpload: (base64: string | null) => void;
  locked?: boolean;
  color?: 'indigo' | 'violet';
}

export type AnalysisMode = 'biometric' | 'crowd';

export interface QualityCheckResult {
  passable: boolean;
  score: number; // 0 to 100
  issues: string[];
  reasoning: string;
}

export interface StudentProfile {
  name: string;
  imageCrop: string; // base64 encoded image of the student's face
}
