import React from 'react';

interface ChartDataPoint {
  date: string;
  value: number;
  label: string;
}

interface AttendanceChartProps {
  data: ChartDataPoint[];
  isStudentView?: boolean;
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ data, isStudentView = false }) => {
  if (!data || data.length === 0) {
    return <div className="text-center py-10 text-slate-400">No data available for this period.</div>;
  }

  const maxValue = isStudentView ? 1 : 100;

  return (
    <div className="w-full h-64 flex gap-2 items-end border-b-2 border-slate-100 pb-4 pr-4">
      {data.map((point, index) => {
        const height = `${(point.value / maxValue) * 100}%`;
        const isAbsent = isStudentView && point.value === 0;
        const bgColor = isStudentView
          ? (isAbsent ? 'bg-red-400 hover:bg-red-500' : 'bg-green-400 hover:bg-green-500')
          : 'bg-indigo-400 hover:bg-indigo-500';
        
        return (
          <div key={index} className="flex-1 h-full flex flex-col justify-end items-center group relative">
            {/* Bar */}
            <div
              className={`w-full rounded-t-lg transition-all duration-300 ${bgColor}`}
              style={{ height: isAbsent ? '100%' : height, minHeight: isAbsent ? '100%' : '4px' }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {point.label}
              <div className="text-slate-300">{new Date(point.date).toLocaleDateString()}</div>
            </div>
            {/* Date Label */}
            <div className="text-[10px] text-slate-400 mt-2 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
              {new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
