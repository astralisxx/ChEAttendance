import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnalysisResult, MissingPerson, ExtraPerson, UnidentifiedPerson, StudentProfile } from '../types';
import { Users, UserMinus, UserCheck, RefreshCw, X, AlertCircle, Trophy, Sparkles, MapPin, ArrowLeft, UserPlus, Printer, Download, HelpCircle } from 'lucide-react';
import { ImageComparisonSlider } from './ImageComparisonSlider';
import { IdentificationModal } from './IdentificationModal';
import { saveStudentProfiles } from '../services/studentProfileService';

interface ResultsDisplayProps {
  result: AnalysisResult;
  onReset: () => void;
  referenceImage: string;
  dailyImage: string;
  studentRoster: string[];
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, onReset, referenceImage, dailyImage, studentRoster }) => {
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'missing' | 'new'>('missing');
  const [selectedItem, setSelectedItem] = useState<MissingPerson | ExtraPerson | null>(null);
  
  // Logic for the Smart Roster identification
  const { unidentifiedStudents, newStudents } = useMemo(() => {
    const presentAndMissingNames = new Set(result.missingPeople.map(p => p.name).filter(Boolean));
    const allRosterNames = new Set(studentRoster);
    
    // Names on the roster that haven't been accounted for yet.
    const unaccountedRosterNames = studentRoster.filter(name => !presentAndMissingNames.has(name));

    // People present in daily photo but not reference photo.
    const unidentified: UnidentifiedPerson[] = [];
    const trulyNew: ExtraPerson[] = [];

    result.extraPeople.forEach(person => {
      if (unaccountedRosterNames.length > unidentified.length) {
        unidentified.push(person);
      } else {
        trulyNew.push(person);
      }
    });

    return { unidentifiedStudents: unidentified, newStudents: trulyNew };
  }, [result, studentRoster]);

  const handleConfirmIdentities = (profiles: StudentProfile[]) => {
    saveStudentProfiles(profiles);
    setShowIdModal(false);
    // Optionally, you could trigger a re-analysis or update state here
    alert(`${profiles.length} student profile(s) saved! They will be recognized in the next analysis.`);
    onReset();
  };

  const isPerfectAttendance = result.missingCount === 0;
  const hasNewStudents = newStudents.length > 0;

  const getInitials = (desc: string) => desc.slice(0, 2).toUpperCase();

  const handlePrint = () => window.print();
  
  const handleExportCSV = () => {
    const headers = ["Status", "Name", "Description"];
    const rows = [
      ...result.missingPeople.map(p => ["MISSING", p.name || "Unknown", p.description.replace(/,/g, ' ')]),
      ...unidentifiedStudents.map(p => ["UNIDENTIFIED", "Needs ID", p.description.replace(/,/g, ' ')]),
      ...newStudents.map(p => ["NEW (Not on Roster)", "Unknown", p.description.replace(/,/g, ' ')]),
    ];
    if (rows.length === 0) rows.push(["PERFECT ATTENDANCE", "All Present", ""]);

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const GalleryModal = () => {
    const isMissingTab = activeTab === 'missing';
    const listData = isMissingTab ? result.missingPeople : [...unidentifiedStudents, ...newStudents];
    const currentImage = isMissingTab ? referenceImage : dailyImage;
    const ThemeIcon = isMissingTab ? UserMinus : UserPlus;

    const getBoxStyle = (box?: number[]) => {
      if (!box || box.length < 4) return {};
      const [ymin, xmin, ymax, xmax] = box;
      return { top: `${ymin * 100}%`, left: `${xmin * 100}%`, height: `${(ymax - ymin) * 100}%`, width: `${(xmax - xmin) * 100}%` };
    };

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 no-print">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-fade-in" onClick={() => setShowGalleryModal(false)} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up transform transition-all">
          <div className={`p-6 border-b border-slate-100 ${isMissingTab ? 'bg-red-50' : 'bg-blue-50'} flex items-center justify-between`}>
            {/* Header Content */}
             <button onClick={() => setShowGalleryModal(false)} className={`p-2 rounded-full transition-colors ${isMissingTab ? 'hover:bg-red-100 text-red-400 hover:text-red-700' : 'hover:bg-blue-100 text-blue-400 hover:text-blue-700'}`}> <X className="w-6 h-6" /></button>
          </div>
          <div className="flex border-b border-slate-100">
             <button onClick={() => { setActiveTab('missing'); setSelectedItem(null); }} className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'missing' ? 'border-red-500 text-red-600 bg-red-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>Missing ({result.missingCount})</button>
             <button onClick={() => { setActiveTab('new'); setSelectedItem(null); }} className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'new' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>New / Unidentified ({result.extraCount})</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
            {selectedItem ? (
              <div className="p-8 flex flex-col items-center animate-fade-in">
                 <button onClick={() => setSelectedItem(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold mb-4 transition-colors"> <ArrowLeft className="w-4 h-4" /> Back to List </button>
                 <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 group">
                    <img src={currentImage} alt="Analysis Source" className="w-full h-auto" />
                    {selectedItem.box_2d && <div className={`absolute border-4 shadow-[0_0_20px_rgba(0,0,0,0.2)] z-10 animate-pulse ${isMissingTab ? 'border-red-500' : 'border-blue-500'}`} style={getBoxStyle(selectedItem.box_2d)} />}
                 </div>
              </div>
            ) : (
              <div className="p-8"><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {listData.map((person, idx) => (<div key={idx} className="group bg-white rounded-2xl p-5 border shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center relative"> {/* ... Person Card ... */}</div>))}
              </div></div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden h-full flex flex-col relative z-0">
      {showGalleryModal && <GalleryModal />}
      {showIdModal && <IdentificationModal unidentified={unidentifiedStudents} availableNames={studentRoster.filter(name => !result.missingPeople.some(p => p.name === name))} dailyImage={dailyImage} onClose={() => setShowIdModal(false)} onConfirm={handleConfirmIdentities} />}

      <div className="p-8 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between print-break-inside">
        <div><h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">Analysis Report</h2></div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors" title="Download CSV"><Download className="w-4 h-4" /><span className="hidden sm:inline">Export</span></button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors" title="Print Report"><Printer className="w-4 h-4" /><span className="hidden sm:inline">Print Report</span></button>
        </div>
      </div>

      <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
        <div className="mb-10 no-print"><ImageComparisonSlider referenceImage={referenceImage} dailyImage={dailyImage} missingPeople={result.missingPeople} extraPeople={result.extraPeople}/></div>
        
        {unidentifiedStudents.length > 0 && (
            <div className="mb-8 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 rounded-2xl flex items-center justify-between gap-4 print-break-inside">
                <div>
                    <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2"><HelpCircle className="w-6 h-6 text-amber-500" />Needs Identification</h3>
                    <p className="text-amber-700 mt-1">{unidentifiedStudents.length} student(s) from the roster were found, but need to be identified.</p>
                </div>
                <button onClick={() => setShowIdModal(true)} className="px-5 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-transform hover:scale-105 shadow-lg shadow-amber-200">Identify Students</button>
            </div>
        )}
        
        {isPerfectAttendance && unidentifiedStudents.length === 0 && newStudents.length === 0 && (
          <div className="mb-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl text-center relative overflow-hidden group print-break-inside">
            <h3 className="text-2xl font-bold text-green-900 mb-2">Perfect Attendance!</h3>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print-break-inside">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center"><span className="text-2xl font-bold text-slate-900 mb-1">{result.referenceCount}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reference</span></div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center"><span className="text-2xl font-bold text-indigo-600 mb-1">{result.dailyCount}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present Today</span></div>
            <div className={`p-4 rounded-2xl border shadow-sm flex flex-col items-center text-center ${result.missingCount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}><span className={`text-2xl font-bold mb-1 ${result.missingCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{result.missingCount}</span><span className={`text-[10px] font-bold uppercase tracking-wider ${result.missingCount > 0 ? 'text-red-400' : 'text-green-400'}`}>Missing</span></div>
            <div className={`p-4 rounded-2xl border shadow-sm flex flex-col items-center text-center ${result.extraCount > 0 ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}><span className={`text-2xl font-bold mb-1 ${result.extraCount > 0 ? 'text-blue-600' : 'text-slate-500'}`}>{result.extraCount}</span><span className={`text-[10px] font-bold uppercase tracking-wider ${result.extraCount > 0 ? 'text-blue-400' : 'text-slate-400'}`}>New/Unidentified</span></div>
        </div>
        
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 print-break-inside">
          <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide"><Sparkles className="w-4 h-4 text-indigo-500" />AI Reasoning</h3>
          <p className="text-sm text-slate-600 leading-7">{result.notes}</p>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 bg-white/50 backdrop-blur-sm no-print">
        <button onClick={onReset} className="w-full flex items-center justify-center gap-2 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl transition-all hover:border-slate-300 hover:shadow-sm">
          <RefreshCw className="w-4 h-4" /> Analyze Another Class
        </button>
      </div>
    </div>
  );
};
