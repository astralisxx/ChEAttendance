import React, { useState, useEffect } from 'react';
import { KeyRound, ArrowRight, Loader2, Users } from 'lucide-react';
import { MASTER_KEY } from '../config';
import { getUserNameByKey } from '../services/userService';
import { pingUsage } from '../services/trackingService';

interface AccessGateProps {
  onAccessGranted: (name: string, isAdmin: boolean) => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({ onAccessGranted }) => {
  const [key, setKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('savedAccessKey');
    if (savedKey) {
      setKey(savedKey);
      setRememberKey(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    const trimmedKey = key.trim();

    if (trimmedKey === MASTER_KEY) {
      // Master key grants admin access
      localStorage.removeItem('savedAccessKey'); // Never save the master key
      await pingUsage("Admin");
      onAccessGranted("Admin", true);
      return;
    }

    const userName = getUserNameByKey(trimmedKey);

    if (userName) {
      // Valid user key
      if (rememberKey) {
        localStorage.setItem('savedAccessKey', trimmedKey);
      } else {
        localStorage.removeItem('savedAccessKey');
      }
      await pingUsage(userName);
      onAccessGranted(userName, false);
    } else {
      // Invalid key
      localStorage.removeItem('savedAccessKey'); // Clear any invalid saved key
      setError('Invalid Access Key. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-50/50 via-white to-slate-100 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
         <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center bg-white p-4 rounded-2xl shadow-lg border border-slate-100 mb-4">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-3 rounded-xl shadow-lg shadow-indigo-500/20">
                    <Users className="w-6 h-6 text-white" />
                </div>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800">ODTÜChE Attendance</h1>
            <p className="text-slate-500 mt-2">Please enter your access key to continue.</p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-8 shadow-2xl shadow-slate-200/50">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your access key"
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-lg font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center mt-4">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberKey}
                onChange={(e) => setRememberKey(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-700">
                Remember my key
              </label>
            </div>

            {error && (
              <p className="text-red-600 text-sm font-semibold mt-3 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !key}
              className="w-full mt-6 py-4 bg-slate-800 text-white rounded-xl font-bold text-lg hover:bg-slate-700 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
         <footer className="text-center mt-8">
            <p className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Developed by Ahmet Berkay Şimşek</p>
        </footer>
      </div>
    </div>
  );
};