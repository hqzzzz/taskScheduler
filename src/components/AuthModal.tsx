import React from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  loginForm: { username: ''; password: '' };
  setLoginForm: (form: any) => void;
  handleLogin: (e: React.FormEvent) => void;
  loginError: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  loginForm,
  setLoginForm,
  handleLogin,
  loginError
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#121212]/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-10">
          <div className="flex flex-col items-center gap-6 mb-10">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-[1.5rem] flex items-center justify-center">
              <Lock className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Access Control</h2>
              <p className="text-gray-500 mt-2 font-medium">Please authenticate to continue</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Username</label>
              <input
                required
                type="text"
                className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                value={loginForm.username}
                onChange={(e) => setLoginForm((prev: any) => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <input
                required
                type="password"
                className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev: any) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            
            {loginError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-in shake duration-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] mt-4"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
