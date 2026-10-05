import React from 'react';
import { Sparkles, Globe, Download } from 'lucide-react';

interface HeaderProps {
  onInstallClick?: () => void;
  canInstall?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onInstallClick, canInstall }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              VoiceTasks <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">AI</span>
            </h1>
            <p className="text-xs text-slate-400">
              {getGreeting()}, <span className="text-slate-200 font-medium">Sarab</span> 👋
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Any Language</span>
          </div>

          {canInstall && (
            <button
              onClick={onInstallClick}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
