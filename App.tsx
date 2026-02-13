import React, { useState, useRef, useEffect } from 'react';
import { Users, CheckCircle, AlertCircle, ChevronRight, FileText, Settings2, ScanEye, AlertTriangle, ArrowRight, XCircle, Sparkles, Upload, FileUp, Loader2, Wand2, RefreshCcw, Edit3, History, BarChart4, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { AnalysisResult, AnalysisMode, QualityCheckResult } from './types';
import { analyzeAttendance, checkImageQuality, extractRosterNames } from './services/geminiService';
import { getStudentProfiles } from './services/studentProfileService';
import { UploadZone } from './components/UploadZone';
import { ResultsDisplay } from './components/ResultsDisplay';
import { HistoryView } from './components/HistoryView';
import { AdminPanel } from './components/AdminPanel';
import { UsersView } from './components/UsersView';
import { AccessGate } from './components/AccessGate';
import { saveHistoryRecord } from './services/historyService';
// @ts-ignore
import { extractRawText } from 'mammoth';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [dailyImage, setDailyImage] = useState<string | null>(null);
  const [studentNames, setStudentNames] = useState<string>("");
  
  const [view, setView] = useState<'analysis' | 'history' | 'admin' | 'users'>('analysis');

  const [isCheckingQuality, setIsCheckingQuality] = useState(false);
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtractingNames, setIsExtractingNames] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [mode, setMode] = useState<AnalysisMode>('biometric');
  const rosterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const storedAdmin = localStorage.getItem('isAdmin');
    if (storedUser) {
      setCurrentUser(storedUser);
      setIsAdmin(storedAdmin === 'true');
    }
  }, []);

  const handleAccessGranted = (name: string, isAdminUser: boolean) => {
    localStorage.setItem('currentUser', name);
    localStorage.setItem('isAdmin', String(isAdminUser));
    setCurrentUser(name);
    setIsAdmin(isAdminUser);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('usagePingSent');
    setCurrentUser(null);
    setIsAdmin(false);
    handleReset();
    setView('analysis');
  };

  const handleReset = () => {
    setReferenceImage(null);
    setDailyImage(null);
    setResult(null);
    setError(null);
    setQualityResult(null);
  };

  const handleRosterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsExtractingNames(true);

    try {
      let extractedData = "";
      
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await extractRawText({ arrayBuffer });
        extractedData = await extractRosterNames(result.value, 'text/plain');
      } else if (file.type === 'application/pdf') {
        const base64 = await new Promise<string>((resolve) => {
           const reader = new FileReader();
           reader.onloadend = () => resolve(reader.result as string);
           reader.readAsDataURL(file);
        });
        extractedData = await extractRosterNames(base64, 'application/pdf');
      } else if (file.type.startsWith('image/')) {
        const base64 = await new Promise<string>((resolve) => {
           const reader = new FileReader();
           reader.onloadend = () => resolve(reader.result as string);
           reader.readAsDataURL(file);
        });
        extractedData = await extractRosterNames(base64, file.type);
      } else {
        const text = await file.text();
        extractedData = await extractRosterNames(text, 'text/plain');
      }

      setStudentNames(prev => {
        if (!prev) return extractedData;
        const separator = prev.trim().endsWith(',') || prev.trim() === '' ? '' : ', ';
        return `${prev}${separator}${extractedData}`;
      });

    } catch (err: any) {
      console.error(err);
      setError(`Failed to process file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExtractingNames(false);
      if (rosterInputRef.current) rosterInputRef.current.value = '';
    }
  };

  const enhanceSingleImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.filter = 'contrast(1.2) brightness(1.1) saturate(1.1)';
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  };

  const handleAutoEnhance = async () => {
    if (!referenceImage || !dailyImage) return;
    
    setIsEnhancing(true);
    try {
      const [newRef, newDaily] = await Promise.all([
        enhanceSingleImage(referenceImage),
        enhanceSingleImage(dailyImage)
      ]);
      setReferenceImage(newRef);
      setDailyImage(newDaily);
      setQualityResult(null);
      setTimeout(() => {
        initiateAnalysis();
      }, 100);
    } catch (e) {
      console.error("Enhancement failed", e);
      setError("Could not auto-enhance images.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const initiateAnalysis = async () => {
    if (!referenceImage || !dailyImage) return;
    setIsCheckingQuality(true);
    setQualityResult(null);
    setError(null);
    try {
      const quality = await checkImageQuality(referenceImage, dailyImage);
      setQualityResult(quality);
    } catch (err) {
      console.warn("Quality check error", err);
      setQualityResult({
        passable: true,
        score: 0,
        issues: ["Quality check service unavailable."],
        reasoning: "Could not verify quality."
      });
    } finally {
      setIsCheckingQuality(false);
    }
  };

  const runMainAnalysis = async () => {
    if (!referenceImage || !dailyImage) return;
    setIsCheckingQuality(false); 
    setQualityResult(null);
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const studentProfiles = getStudentProfiles();
      const analysis = await analyzeAttendance(referenceImage, dailyImage, studentNames, mode, studentProfiles);
      setResult(analysis);
      
      saveHistoryRecord({
        id: Date.now(),
        date: new Date().toISOString(),
        studentRoster: studentNames.split(',').map(s => s.trim()).filter(Boolean),
        ...analysis
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderQualityReport = () => {
    if (!qualityResult) return null;
    const { score, issues, reasoning } = qualityResult;
    let colorClass = score < 50 ? 'text-red-600' : score < 80 ? 'text-amber-600' : 'text-green-600';
    let bgClass = score < 50 ? 'bg-red-100' : score < 80 ? 'bg-amber-100' : 'bg-green-100';
    const canAutoEnhance = score >= 40 && score < 90;

    return (
      <div className={`relative bg-white/90 backdrop-blur-xl border rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fade-in-up mx-auto z-20 ${score < 50 ? 'border-red-200 shadow-red-500/10' : 'border-slate-200 shadow-indigo-500/10'}`}>
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${bgClass}`}><ScanEye className={`w-5 h-5 ${colorClass}`} /></div>
             <h3 className="text-xl font-bold text-slate-800">Quality Check</h3>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${bgClass} ${colorClass}`}>{score}% Score</div>
        </div>
        <div className="flex gap-6 mb-6">
          <div className="flex-1">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">AI Assessment</p>
            <p className="text-slate-800 text-sm mb-4 leading-relaxed font-medium">{reasoning}</p>
            {issues.length > 0 && (
              <>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Detected Issues</p>
                <ul className="space-y-2">{issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded-md">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />{issue}
                    </li>))}
                </ul>
              </>
            )}
          </div>
          <div className="flex items-center justify-center flex-shrink-0">
             <div className="relative w-28 h-28">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-md">
                  <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                  <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={289} strokeDashoffset={289 - (289 * score) / 100} className={`${colorClass} transition-all duration-1000 ease-out`} strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col"><span className={`text-2xl font-bold ${colorClass}`}>{score}</span></div>
             </div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          {canAutoEnhance ? (
             <button onClick={handleAutoEnhance} disabled={isEnhancing} className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all">
               {isEnhancing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}Auto-Fix & Retry
             </button>
          ) : (
             <button onClick={() => setQualityResult(null)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all">
               <RefreshCcw className="w-4 h-4" />Retake Photos
             </button>
          )}
          <button onClick={runMainAnalysis} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 ${score < 50 ? 'bg-gradient-to-r from-red-500 to-red-600 hover:to-red-700' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:to-indigo-700'}`}>
            {score < 50 ? 'Try Anyway' : 'Start Analysis'}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };
  
  const renderAnalysisView = () => (
    <>
        {!result && !isAnalyzing && !isCheckingQuality && !qualityResult && !isEnhancing && (
          <div className="mb-10 text-center max-w-2xl mx-auto animate-fade-in-up no-print">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-100 shadow-sm mb-6">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI-Powered Tracking</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">Attendance Tracking</h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">Upload a reference photo and today's class photo. The model will instantly identify who is missing with biometric precision.</p>
          </div>
        )}
        <div className={`grid gap-8 transition-all duration-700 ease-in-out ${result ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1 lg:grid-cols-2'}`}>
          <div className={`flex flex-col gap-6 ${result ? 'lg:col-span-3 no-print' : ''}`}>
             <UploadZone title="Reference Photo" description={referenceImage ? 'Reference Image' : 'Master photo of class'} image={referenceImage} onImageUpload={setReferenceImage} locked={isAnalyzing || isCheckingQuality || !!result || !!qualityResult || isEnhancing} color="indigo"/>
            <div className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-5 shadow-lg shadow-slate-200/50 ${result ? 'hidden lg:block' : ''}`}>
               <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2"><Settings2 className="w-4 h-4 text-indigo-600" /><h3>Detection Mode</h3></div>
              <div className="flex flex-col gap-3">
                <label className={`relative overflow-hidden flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${mode === 'biometric' ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-200 hover:bg-white'}`}>
                  <input type="radio" name="mode" value="biometric" checked={mode === 'biometric'} onChange={() => setMode('biometric')} disabled={isAnalyzing || isCheckingQuality || !!result || !!qualityResult || isEnhancing} className="mt-1"/>
                  <div><span className="block text-sm font-bold text-slate-800">Biometric Focus</span><span className="block text-xs text-slate-500 mt-1 leading-snug">Precision matching using facial landmarks. Best for &lt;15 people.</span></div>
                </label>
                <label className={`relative overflow-hidden flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${mode === 'crowd' ? 'border-violet-500 bg-violet-50/50 shadow-sm' : 'border-slate-200 hover:bg-white'}`}>
                  <input type="radio" name="mode" value="crowd" checked={mode === 'crowd'} onChange={() => setMode('crowd')} disabled={isAnalyzing || isCheckingQuality || !!result || !!qualityResult || isEnhancing} className="mt-1"/>
                  <div><span className="block text-sm font-bold text-slate-800">Crowd Patterns</span><span className="block text-xs text-slate-500 mt-1 leading-snug">Analyzes clothing & position. Best for large classes (40+).</span></div>
                </label>
              </div>
            </div>
            <div className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-5 shadow-lg shadow-slate-200/50 ${result ? 'hidden lg:block' : ''}`}>
              <div className="flex items-center justify-between mb-3 text-slate-800 font-bold">
                <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-600" /><h3>Class Roster</h3></div>
                {studentNames && (<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {studentNames.split(',').map(s=>s.trim()).filter(Boolean).length} names</span>)}
              </div>
              <div className="space-y-3">
                 <textarea value={studentNames} onChange={(e) => setStudentNames(e.target.value)} placeholder="Enter names from left to right, top to bottom..." disabled={isAnalyzing || isCheckingQuality || !!result || isEnhancing} className="w-full h-24 p-3 text-sm leading-relaxed border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none bg-white placeholder:text-slate-400 shadow-inner"/>
                <div className="relative">
                  <input ref={rosterInputRef} type="file" accept=".csv,.txt,.docx,.pdf,image/*" onChange={handleRosterFileChange} disabled={isAnalyzing || isCheckingQuality || !!result || isEnhancing || isExtractingNames} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"/>
                  <div className="border border-slate-200 rounded-xl p-3 flex items-center gap-3 bg-white transition-all hover:border-indigo-300 hover:shadow-sm">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-500">{isExtractingNames ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}</div>
                    <div className="flex-1 overflow-hidden">
                       <p className="text-sm font-semibold text-slate-700 truncate">{isExtractingNames ? "Processing file..." : "Upload & Append Roster"}</p>
                       <p className="text-xs text-slate-400 truncate">Supports PDF, DOCX, Image, CSV, TXT</p>
                    </div><ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`${result ? 'lg:col-span-9' : ''} flex flex-col gap-6`}>
             {result ? (<ResultsDisplay result={result} onReset={handleReset} referenceImage={referenceImage!} dailyImage={dailyImage!} studentRoster={studentNames.split(',').map(s => s.trim()).filter(Boolean)} />) : (
               <>
                 <UploadZone title="Today's Photo" description={dailyImage ? 'Current Image' : 'Photo taken today'} image={dailyImage} onImageUpload={setDailyImage} locked={isAnalyzing || isCheckingQuality || isEnhancing} color="violet"/>
                 {(referenceImage && dailyImage) && (
                    <div className="animate-fade-in-up">
                       {error && (<div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700"><AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span className="text-sm font-medium">{error}</span></div>)}
                       {isCheckingQuality || qualityResult ? (
                          <div className="flex justify-center">
                            {isCheckingQuality ? (<div className="bg-white/90 backdrop-blur border border-slate-200 px-8 py-4 rounded-2xl shadow-xl flex items-center gap-4"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /><span className="font-bold text-slate-700">Verifying Image Quality...</span></div>) : (renderQualityReport())}
                          </div>
                       ) : (
                         <button onClick={initiateAnalysis} disabled={isAnalyzing} className="w-full py-5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-3xl font-bold text-lg shadow-xl shadow-slate-200/50 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 group relative overflow-hidden">
                           {isAnalyzing ? (<><Loader2 className="w-6 h-6 animate-spin text-indigo-300" /><span className="text-indigo-100">Analyzing Attendance...</span></>) : (<><span>Start Attendance Check</span><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>)}
                           {!isAnalyzing && (<div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />)}
                         </button>
                       )}
                    </div>
                 )}
               </>
             )}
          </div>
        </div>
    </>
  );

  if (!currentUser) {
    return <AccessGate onAccessGranted={handleAccessGranted} />;
  }

  const CurrentView = () => {
    switch(view) {
      case 'analysis': return renderAnalysisView();
      case 'history': return <HistoryView />;
      case 'users': return <UsersView />;
      case 'admin': return <AdminPanel />;
      default: return renderAnalysisView();
    }
  };

  return (
    <div className="min-h-screen text-slate-900 pb-12 bg-gradient-to-br from-indigo-50/50 via-white to-slate-100 relative">
      <header className="fixed top-0 w-full z-40 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-violet-700">ODTÜChE Attendance</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-sm font-bold text-slate-700">{currentUser}</span>
              <span className={`text-xs block ${isAdmin ? 'text-indigo-500 font-bold' : 'text-slate-400'}`}>
                {isAdmin ? 'Administrator' : 'Signed In'}
              </span>
            </div>
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
              <button onClick={() => setView('analysis')} className={`px-4 py-1.5 text-sm font-bold rounded-full flex items-center gap-2 transition-colors ${view === 'analysis' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                <BarChart4 className="w-4 h-4" /> Analysis
              </button>
              <button onClick={() => setView('history')} className={`px-4 py-1.5 text-sm font-bold rounded-full flex items-center gap-2 transition-colors ${view === 'history' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                <History className="w-4 h-4" /> History
              </button>
              <button onClick={() => setView('users')} className={`px-4 py-1.5 text-sm font-bold rounded-full flex items-center gap-2 transition-colors ${view === 'users' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                <UserIcon className="w-4 h-4" /> Users
              </button>
              {isAdmin && (
                <button onClick={() => setView('admin')} className={`px-4 py-1.5 text-sm font-bold rounded-full flex items-center gap-2 transition-colors ${view === 'admin' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                  <ShieldCheck className="w-4 h-4" /> Admin
                </button>
              )}
            </nav>
             <button onClick={handleLogout} title="Logout" className="p-2.5 bg-slate-100 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <CurrentView />
      </main>
      
      <footer className="text-center py-8 px-4 no-print">
        <p className="text-slate-400 text-xs font-medium mb-3">Powered by Gemini 3 Pro Vision • Biometric & Contextual Analysis</p>
        <div className="inline-block bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2 shadow-sm">
            <p className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Developed by Ahmet Berkay Şimşek</p>
        </div>
    </footer>
    </div>
  );
};

export default App;