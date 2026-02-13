import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, UserCheck, AlertTriangle, ChevronsUpDown } from 'lucide-react';
import { UnidentifiedPerson, Gender, StudentProfile } from '../types';
import { getGenderForNames } from '../services/geminiService';

interface IdentificationModalProps {
  unidentified: UnidentifiedPerson[];
  availableNames: string[];
  dailyImage: string;
  onClose: () => void;
  onConfirm: (profiles: StudentProfile[]) => void;
}

const cropImage = (imageBase64: string, box: number[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const [ymin, xmin, ymax, xmax] = box;
      const sx = xmin * img.width;
      const sy = ymin * img.height;
      const sWidth = (xmax - xmin) * img.width;
      const sHeight = (ymax - ymin) * img.height;

      const canvas = document.createElement('canvas');
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        reject(new Error('Canvas context not available'));
      }
    };
    img.onerror = reject;
    img.src = imageBase64;
  });
};

export const IdentificationModal: React.FC<IdentificationModalProps> = ({
  unidentified,
  availableNames,
  dailyImage,
  onClose,
  onConfirm,
}) => {
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [nameGenders, setNameGenders] = useState<Record<string, Gender>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getGenderForNames(availableNames).then(setNameGenders);
  }, [availableNames]);

  const handleAssignmentChange = (personIndex: number, name: string) => {
    setAssignments(prev => ({ ...prev, [personIndex]: name }));
  };
  
  const handleConfirm = async () => {
    setIsLoading(true);
    const profiles: StudentProfile[] = [];
    const promises = Object.entries(assignments).map(async ([indexStr, name]) => {
      const personIndex = parseInt(indexStr, 10);
      const person = unidentified[personIndex];
      if (name && person.box_2d) {
        try {
          const imageCrop = await cropImage(dailyImage, person.box_2d);
          profiles.push({ name, imageCrop });
        } catch (error) {
          console.error("Failed to crop image for", name, error);
        }
      }
    });
    await Promise.all(promises);
    onConfirm(profiles);
    setIsLoading(false);
  };
  
  const unassignedNames = useMemo(() => {
    const assigned = new Set(Object.values(assignments));
    return availableNames.filter(name => !assigned.has(name));
  }, [assignments, availableNames]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 no-print animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800">Identify New Students</h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"> <X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
           <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg text-amber-800">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <p className="text-sm font-medium">Help the AI learn! By matching faces to names, future attendance checks will become more accurate.</p>
                </div>
            </div>

          {unidentified.map((person, index) => {
            const currentSelection = assignments[index] || '';
            return (
              <div key={index} className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl">
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-slate-100">
                   {person.box_2d && <img src={dailyImage} alt="Student" className="w-full h-full object-cover" style={{ objectPosition: `${person.box_2d[1] * 100}% ${person.box_2d[0] * 100}%` }} />}
                </div>
                <div className="flex-1">
                   <p className="text-sm text-slate-500">{person.description} (Gender: {person.gender})</p>
                  <div className="relative mt-2">
                     <select
                      value={currentSelection}
                      onChange={(e) => handleAssignmentChange(index, e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                     >
                        <option value="">-- Select a Name --</option>
                        {currentSelection && <option value={currentSelection}>{currentSelection}</option>}
                        {unassignedNames.map(name => {
                            const nameGender = nameGenders[name];
                            const isMismatch = person.gender !== 'Unknown' && nameGender && nameGender !== 'Unknown' && person.gender !== nameGender;
                            return (
                               <option key={name} value={name} disabled={isMismatch}>
                                {name} {isMismatch ? `(${nameGender}?)` : ''}
                               </option>
                            );
                        })}
                     </select>
                     <ChevronsUpDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={isLoading || Object.keys(assignments).length === 0} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center gap-2">
            <UserCheck className="w-5 h-5" /> Confirm Identities
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
