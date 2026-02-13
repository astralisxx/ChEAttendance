import React, { useState, useEffect } from 'react';
import { UserPlus, KeyRound, Copy, Trash2, CheckCircle, ShieldCheck, User as UserIcon } from 'lucide-react';
import { getUsers, addUser, deleteUser } from '../services/userService';

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<Record<string, string>>({});
  const [newUserName, setNewUserName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{ name: string; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    const name = newUserName.trim();
    const key = addUser(name);

    setGeneratedKey({ name, key });
    setNewUserName('');
    setUsers(getUsers()); // Refresh user list from the source of truth
  };

  const handleDeleteUser = (key: string) => {
    const userToDelete = users[key];
    if (window.confirm(`Are you sure you want to delete user "${userToDelete}"? This will revoke their access.`)) {
      deleteUser(key);
      setUsers(getUsers()); // Refresh user list from the source of truth
    }
  };
  
  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50 mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-500" />
          Admin Panel: User Management
        </h2>
      </div>

      {/* Add New User Form */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50 mb-8">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-indigo-500" />
          Generate New Access Key
        </h3>
        <form onSubmit={handleAddUser} className="flex items-center gap-3">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Enter new user's name"
            className="flex-1 p-3 bg-white border border-slate-200 rounded-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button type="submit" disabled={!newUserName.trim()} className="px-5 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300">
            Generate Key
          </button>
        </form>
        {generatedKey && (
          <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
            <p className="text-sm text-green-800">
              Successfully created key for <strong>{generatedKey.name}</strong>.
            </p>
            <div className="mt-2 flex items-center gap-2 bg-white p-2 rounded-lg border">
              <KeyRound className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <code className="flex-1 text-sm font-mono text-slate-700 break-all">{generatedKey.key}</code>
              <button onClick={() => handleCopy(generatedKey.key)} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200">
                {copiedKey === generatedKey.key ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User List */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 shadow-lg shadow-slate-200/50">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Manage Authorized Users ({Object.keys(users).length})</h3>
        <div className="space-y-3">
          {Object.entries(users).map(([key, name]) => {
            const isDefaultAdmin = key === 'GEMINI-DEV-01';
            return (
              <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${isDefaultAdmin ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${isDefaultAdmin ? 'bg-indigo-100' : 'bg-slate-200'}`}>
                    {isDefaultAdmin ? <ShieldCheck className="w-4 h-4 text-indigo-600" /> : <UserIcon className="w-4 h-4 text-slate-600" />}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${isDefaultAdmin ? 'text-indigo-800' : 'text-slate-800'}`}>{name}</p>
                    {isDefaultAdmin ? (
                      <p className="text-xs text-indigo-500 font-medium">System Administrator</p>
                    ) : (
                      <p className="text-xs text-slate-500 font-medium">Authorized User</p>
                    )}
                    <p className="text-xs text-slate-400 font-mono mt-1">{key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => handleCopy(key)} title="Copy Key" className="p-2 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 rounded-lg transition-colors">
                      {copiedKey === key ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                   </button>
                   {!isDefaultAdmin && (
                     <button onClick={() => handleDeleteUser(key)} title="Delete User" className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors">
                        <Trash2 className="w-5 h-5" />
                     </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};