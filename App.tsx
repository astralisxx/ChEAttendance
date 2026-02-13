import React, { useState, useRef, useEffect } from 'react';
import { Users, CheckCircle, AlertCircle, ArrowRight, Sparkles, Loader2, History, BarChart4, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { AnalysisResult, AnalysisMode, QualityCheckResult } from './types.ts';
import { analyzeAttendance, checkImageQuality, extractRosterNames } from './services/geminiService.ts';
import { getStudentProfiles } from './services/studentProfileService.ts';
import { HistoryView } from './components/HistoryView.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { UsersView } from './components/UsersView.tsx';
import { AccessGate } from './components/AccessGate.tsx';
import { saveHistoryRecord } from './services/historyService.ts';
import { AnalysisView } from './components/AnalysisView.tsx';
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

  if (!currentUser) {
    return <AccessGate onAccessGranted={handleAccessGranted} />;
  }

  const renderCurrentView = () => {
    switch(view) {
      case 'analysis': 
        return <AnalysisView 
            result={result}
            isAnalyzing={isAnalyzing}
            isCheckingQuality={isCheckingQuality}
            qualityResult={qualityResult}
            isEnhancing={isEnhancing}
            referenceImage={referenceImage}
            dailyImage={dailyImage}
            studentNames={studentNames}
            mode={mode}
            rosterInputRef={rosterInputRef}
            isExtractingNames={isExtractingNames}
            error={error}
            setReferenceImage={setReferenceImage}
            setDailyImage={setDailyImage}
            setStudentNames={setStudentNames}
            setMode={setMode}
            handleRosterFileChange={handleRosterFileChange}
            initiateAnalysis={initiateAnalysis}
            runMainAnalysis={runMainAnalysis}
            handleAutoEnhance={handleAutoEnhance}
            setQualityResult={setQualityResult}
            onReset={handleReset}
        />;
      case 'history': return <HistoryView />;
      case 'users': return <UsersView />;
      case 'admin': return <AdminPanel />;
      default: 
        return <AnalysisView
            result={result}
            isAnalyzing={isAnalyzing}
            isCheckingQuality={isCheckingQuality}
            qualityResult={qualityResult}
            isEnhancing={isEnhancing}
            referenceImage={referenceImage}
            dailyImage={dailyImage}
            studentNames={studentNames}
            mode={mode}
            rosterInputRef={rosterInputRef}
            isExtractingNames={isExtractingNames}
            error={error}
            setReferenceImage={setReferenceImage}
            setDailyImage={setDailyImage}
            setStudentNames={setStudentNames}
            setMode={setMode}
            handleRosterFileChange={handleRosterFileChange}
            initiateAnalysis={initiateAnalysis}
            runMainAnalysis={runMainAnalysis}
            handleAutoEnhance={handleAutoEnhance}
            setQualityResult={setQualityResult}
            onReset={handleReset}
        />;
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
        {renderCurrentView()}
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