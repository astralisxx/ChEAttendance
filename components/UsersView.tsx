import React, { useState, useEffect } from 'react';
import { ShieldCheck, User as UserIcon, Users } from 'lucide-react';
import { getUsers } from '../services/userService';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  // Find the admin user entry if it exists
  const adminUserEntry = Object.entries(users).find(([key]) => key === 'GEMINI-DEV-01');

  // Filter out the admin user for the regular list
  const filteredUserEntries = Object.entries(users).filter(([key]) => key !== 'GEMINI-DEV-01');

  return (
    <div className="animate-fade-in-up">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50 mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Users className="w-6 h-6 text-indigo-500" />
          Authorized Personnel
        </h2>
        <p className="text-slate-500 mt-2">This is a list of all individuals with access to this application.</p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50">
        <div className="space-y-4">
          {/* Special entry for Admin */}
          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-full">
                <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              </div>
              <div>
                <p className="font-bold text-indigo-800">{adminUserEntry ? adminUserEntry[1] : 'Admin'}</p>
                <p className="text-xs text-indigo-500 font-medium">System Administrator</p>
              </div>
            </div>
          </div>

          {/* List of regular users */}
          {filteredUserEntries.map(([key, name]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-slate-100 rounded-full">
                    <UserIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                 </div>
                 <div>
                    <p className="font-bold text-slate-800">{name}</p>
                    <p className="text-xs text-slate-400 font-medium">Authorized User</p>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};