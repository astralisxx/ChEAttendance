
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsLeftRight, Eye, EyeOff } from 'lucide-react';
import { MissingPerson, ExtraPerson } from '../types';

interface ImageComparisonSliderProps {
  referenceImage: string;
  dailyImage: string;
  missingPeople?: MissingPerson[];
  extraPeople?: ExtraPerson[];
}

export const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({ 
  referenceImage, 
  dailyImage,
  missingPeople = [],
  extraPeople = []
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  // Default is now false (hidden) per user request
  const [showOverlays, setShowOverlays] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = (x / rect.width) * 100;
      setSliderPosition(percent);
    }
  }, []);

  const onMouseDown = () => setIsDragging(true);
  const onTouchStart = () => setIsDragging(true);
  const onMouseUp = () => setIsDragging(false);
  
  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isDragging) handleMove(e.touches[0].clientX);
  };
  
  const onClick = (e: React.MouseEvent) => {
      // Prevent click from triggering if we just dragged
      if (!isDragging) {
        handleMove(e.clientX);
      }
  }

  useEffect(() => {
    const handleGlobalUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    
    return () => {
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchend', handleGlobalUp);
    }
  }, []);

  // Helper to calculate style for bounding box
  const getBoxStyle = (box: number[]) => {
    if (!box || box.length < 4) return { display: 'none' };
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${ymin * 100}%`,
      left: `${xmin * 100}%`,
      height: `${(ymax - ymin) * 100}%`,
      width: `${(xmax - xmin) * 100}%`,
    };
  };

  return (
    <div className="w-full select-none mb-2 relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-40 flex gap-2">
         <button 
           onClick={(e) => { e.stopPropagation(); setShowOverlays(!showOverlays); }}
           className="bg-slate-900/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-slate-900/80 transition-colors border border-white/10"
           title={showOverlays ? "Hide Detection Boxes" : "Show Detection Boxes"}
         >
           {showOverlays ? <Eye size={16} /> : <EyeOff size={16} />}
         </button>
      </div>

      <div 
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden cursor-ew-resize group shadow-lg border border-slate-200 bg-slate-100 touch-none"
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={onClick}
      >
        {/* Invisible Spacer Image to set container height based on aspect ratio */}
        <img src={referenceImage} alt="" className="w-full h-auto opacity-0 pointer-events-none" />

        {/* 1. LAYER: Daily Image (Background - "After") */}
        <div className="absolute inset-0 w-full h-full">
            <img 
              src={dailyImage} 
              alt="Today" 
              className="w-full h-full object-fill pointer-events-none select-none"
            />
            {/* New People Overlays (Blue) */}
            {showOverlays && extraPeople.map((person, idx) => person.box_2d && (
               <div 
                 key={`extra-${idx}`}
                 className="absolute border-4 border-blue-500 bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10"
                 style={getBoxStyle(person.box_2d)}
               >
                 <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    New
                 </div>
               </div>
            ))}
            
            {/* Label */}
            <div className="absolute top-4 right-14 bg-slate-900/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold pointer-events-none z-10 border border-white/10">
              Today (New Students)
            </div>
        </div>

        {/* 2. LAYER: Reference Image (Foreground - "Before" - Clipped) */}
        <div 
          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-20 will-change-[clip-path]"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <div className="relative w-full h-full">
             <img 
               src={referenceImage} 
               alt="Reference" 
               className="w-full h-full object-fill" 
             />
             
             {/* Missing People Overlays (Red) */}
             {showOverlays && missingPeople.map((person, idx) => person.box_2d && (
                <div 
                  key={`missing-${idx}`}
                  className="absolute border-4 border-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  style={getBoxStyle(person.box_2d)}
                >
                   <div className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                      {person.name || "Missing"}
                   </div>
                </div>
             ))}

             {/* Label */}
             <div className="absolute top-4 left-4 bg-indigo-600/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold pointer-events-none border border-white/10">
              Reference (Missing)
            </div>
          </div>
        </div>

        {/* Slider Handle */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-30 shadow-[0_0_15px_rgba(0,0,0,0.3)]"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg text-indigo-600 border border-slate-100 transform transition-transform group-hover:scale-110 group-active:scale-95">
            <ChevronsLeftRight size={20} />
          </div>
        </div>
      </div>
       <p className="text-center text-xs text-slate-400 mt-3 font-medium flex items-center justify-center gap-2">
          <ChevronsLeftRight size={14} />
          Drag slider to compare & find people
       </p>
    </div>
  );
};
