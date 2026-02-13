import React, { useState, useEffect, useMemo } from 'react';
import { History, User, Calendar, Check, X, Filter, Trash2, BarChart, AlertTriangle } from 'lucide-react';
import { getHistoryRecords, clearHistory } from '../services/historyService';
import { HistoryRecord } from '../types';
import { AttendanceChart } from './AttendanceChart';

type DateFilter = '7d' | '30d' | 'all';

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

  useEffect(() => {
    setRecords(getHistoryRecords());
  }, []);

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to permanently delete all attendance records? This action cannot be undone.")) {
      clearHistory();
      setRecords([]);
    }
  };

  const allStudents = useMemo(() => {
    const studentSet = new Set<string>();
    records.forEach(rec => {
      rec.studentRoster.forEach(name => studentSet.add(name));
    });
    return Array.from(studentSet).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let dateFiltered = records;
    const now = new Date();
    if (dateFilter !== 'all') {
      const days = dateFilter === '7d' ? 7 : 30;
      const cutoff = new Date(now.setDate(now.getDate() - days));
      dateFiltered = records.filter(rec => new Date(rec.date) >= cutoff);
    }
    return dateFiltered;
  }, [records, dateFilter]);

  const chartData = useMemo(() => {
    if (studentFilter === 'all') {
      return filteredRecords.map(rec => ({
        date: rec.date,
        value: rec.attendanceRate,
        label: `${Math.round(rec.attendanceRate)}%`,
      })).reverse();
    } else {
      return filteredRecords.map(rec => {
        const isPresent = !rec.missingPeople.some(p => p.name === studentFilter);
        return {
          date: rec.date,
          value: isPresent ? 1 : 0,
          label: isPresent ? 'Present' : 'Absent',
        };
      }).reverse();
    }
  }, [filteredRecords, studentFilter]);

  if (records.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl shadow-sm border animate-fade-in-up">
        <div className="inline-block bg-slate-100 p-4 rounded-full mb-4">
            <History className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">No Attendance History</h3>
        <p className="text-slate-500 mt-2">Complete an analysis to start building your attendance log.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header & Filters */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <History className="w-6 h-6 text-indigo-500" />
            Attendance Log
          </h2>
          <button onClick={handleClearHistory} className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" /> Clear All History
          </button>
        </div>
        <hr className="my-6 border-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-slate-600 flex items-center gap-2 mb-2"><Calendar className="w-4 h-4" />Date Range</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['7d', '30d', 'all'] as DateFilter[]).map(df => (
                <button key={df} onClick={() => setDateFilter(df)} className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${dateFilter === df ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {df === '7d' ? 'Last 7 Days' : df === '30d' ? 'Last 30 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-600 flex items-center gap-2 mb-2"><User className="w-4 h-4" />Filter by Student</label>
            <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Students</option>
              {allStudents.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50 mb-8">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <BarChart className="w-5 h-5 text-indigo-500" />
            {studentFilter === 'all' ? 'Overall Attendance Trend' : `Attendance for ${studentFilter}`}
        </h3>
        <AttendanceChart data={chartData} isStudentView={studentFilter !== 'all'} />
      </div>

      {/* Record List */}
      {filteredRecords.length > 0 ? (
        <div className="space-y-4">
          {filteredRecords.map(rec => {
            const isExpanded = expandedRecordId === rec.id;
            let studentStatus = 'rostered'; // or 'absent', 'present', 'new'
            if (studentFilter !== 'all') {
                if (!rec.studentRoster.includes(studentFilter)) {
                    studentStatus = 'not_rostered';
                } else if (rec.missingPeople.some(p => p.name === studentFilter)) {
                    studentStatus = 'absent';
                } else {
                    studentStatus = 'present';
                }
            }
            return (
              <div key={rec.id} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-md shadow-slate-200/50 overflow-hidden">
                <div className="p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                    <div className="font-bold text-slate-700">
                      <div>{new Date(rec.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="text-xs text-slate-400 font-medium">{new Date(rec.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="text-center">
                        <span className="text-2xl font-bold text-indigo-600">{Math.round(rec.attendanceRate)}%</span>
                        <div className="text-xs font-bold text-slate-400 uppercase">Rate</div>
                    </div>
                    <div className="text-center">
                        <span className="text-2xl font-bold text-green-600">{rec.dailyCount - rec.extraCount}</span>
                        <div className="text-xs font-bold text-slate-400 uppercase">Present</div>
                    </div>
                     <div className="text-center">
                        <span className="text-2xl font-bold text-red-600">{rec.missingCount}</span>
                        <div className="text-xs font-bold text-slate-400 uppercase">Absent</div>
                    </div>
                    {studentFilter !== 'all' && (
                        <div className="text-center">
                            {studentStatus === 'present' && <span className="px-3 py-1 text-sm font-bold text-green-700 bg-green-100 rounded-full">Present</span>}
                            {studentStatus === 'absent' && <span className="px-3 py-1 text-sm font-bold text-red-700 bg-red-100 rounded-full">Absent</span>}
                            {studentStatus === 'not_rostered' && <span className="px-3 py-1 text-sm font-bold text-slate-500 bg-slate-100 rounded-full">Not on Roster</span>}
                        </div>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-slate-50 p-4 border-t border-slate-200 animate-fade-in">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      {rec.missingPeople.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-red-600 mb-2">Missing Students ({rec.missingCount})</h4>
                          <ul className="list-disc list-inside text-slate-600 space-y-1">
                            {rec.missingPeople.map(p => <li key={p.description}>{p.name || p.description}</li>)}
                          </ul>
                        </div>
                      ) : ( <div><h4 className="font-bold text-green-600">No Missing Students</h4></div>)}
                       {rec.extraPeople.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-blue-600 mb-2">New Students ({rec.extraCount})</h4>
                          <ul className="list-disc list-inside text-slate-600 space-y-1">
                            {rec.extraPeople.map(p => <li key={p.description}>{p.description}</li>)}
                          </ul>
                        </div>
                      ): ( <div><h4 className="font-bold text-slate-600">No New Students</h4></div>)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border">
            <Filter className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700">No Records Found</h3>
            <p className="text-sm text-slate-500">Try adjusting your filters or complete a new analysis.</p>
        </div>
      )}
    </div>
  );
};
