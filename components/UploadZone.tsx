import React, { useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Lock } from 'lucide-react';
import { ImageUploadProps } from '../types';

export const UploadZone: React.FC<ImageUploadProps> = ({ 
  title, 
  description, 
  image, 
  onImageUpload, 
  locked = false,
  color = 'indigo'
}) => {
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!locked) {
      onImageUpload(null);
    }
  };

  const borderColor = color === 'indigo' ? 'hover:border-indigo-400 hover:ring-4 hover:ring-indigo-50' : 'hover:border-violet-400 hover:ring-4 hover:ring-violet-50';
  const iconColor = color === 'indigo' ? 'text-indigo-600' : 'text-violet-600';
  const bgColor = color === 'indigo' ? 'bg-indigo-50' : 'bg-violet-50';
  const gradientText = color === 'indigo' ? 'from-indigo-600 to-blue-600' : 'from-violet-600 to-purple-600';

  return (
    <div className="flex flex-col h-full group/container">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className={`font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r ${gradientText}`}>
          {title}
        </h3>
        {image && !locked && (
          <button 
            onClick={handleClear}
            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-full font-bold flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      
      <label className={`
        relative flex-1 flex flex-col items-center justify-center w-full min-h-[340px] 
        rounded-3xl border-2 border-dashed border-slate-300 transition-all duration-300 overflow-hidden
        ${locked ? 'cursor-default' : 'cursor-pointer hover:bg-white'}
        ${locked ? '' : borderColor}
        bg-white/50 backdrop-blur-sm shadow-sm
      `}>
        {!locked && (
           <input 
            type="file" 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
            disabled={locked} 
          />
        )}
       
        {image ? (
          <div className="relative w-full h-full group/image">
            <img 
              src={image} 
              alt={title} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-105"
            />
            
            {/* Overlay for actions when not locked */}
            {!locked && (
              <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center">
                 <div className="opacity-0 group-hover/image:opacity-100 bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-semibold shadow-lg transform translate-y-4 group-hover/image:translate-y-0 transition-all duration-300">
                    Click to change
                 </div>
              </div>
            )}

            {locked && (
              <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center">
                 <div className="bg-white/90 px-4 py-2 rounded-full text-sm font-bold shadow-lg text-slate-700 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Locked
                 </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center p-8 text-center transform transition-transform duration-300 group-hover/container:scale-105">
            <div className={`
              p-6 rounded-3xl ${bgColor} mb-6 shadow-inner relative overflow-hidden
            `}>
              <Upload className={`w-10 h-10 ${iconColor} relative z-10`} />
              <div className="absolute inset-0 bg-white/20 blur-xl"></div>
            </div>
            <p className="text-lg font-bold text-slate-800 mb-2">
              Drag & drop or click
            </p>
            <p className="text-sm text-slate-500 max-w-[220px] leading-relaxed">
              {description}
            </p>
          </div>
        )}
      </label>
    </div>
  );
};