import React, { useState, useEffect } from 'react';
import { X, Key, Check, ExternalLink, ShieldCheck, Sparkles, Bell, Volume2, Server } from 'lucide-react';
import { api } from '../services/api';
import {
  getNotificationPermission,
  requestNotificationPermission,
  playReminderChime,
} from '../services/notificationService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [savedNotice, setSavedNotice] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission
  );
  const [serverStatus, setServerStatus] = useState<{
    backend_ai_configured: boolean;
    provider: string;
    has_gemini: boolean;
    has_openai: boolean;
    has_groq: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getVoiceStatus().then(setServerStatus).catch(() => {});
    }
  }, [isOpen]);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  };

  const handleTestChime = () => {
    playReminderChime();
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (groqKey.trim()) localStorage.setItem('groq_api_key', groqKey.trim());
    else localStorage.removeItem('groq_api_key');

    if (geminiKey.trim()) localStorage.setItem('gemini_api_key', geminiKey.trim());
    else localStorage.removeItem('gemini_api_key');

    if (openaiKey.trim()) localStorage.setItem('openai_api_key', openaiKey.trim());
    else localStorage.removeItem('openai_api_key');

    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI & Speech Settings</h3>
              <p className="text-xs text-slate-400">Configure cloud models & API keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Status info */}
          <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
            serverStatus?.backend_ai_configured
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'
              : 'bg-indigo-950/40 border-indigo-800/40 text-slate-300'
          }`}>
            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-2">
                {serverStatus?.backend_ai_configured ? (
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>AI Task Parsing Status</span>
              </div>
              {serverStatus && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  serverStatus.backend_ai_configured
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {serverStatus.backend_ai_configured
                    ? `Server AI: ${serverStatus.provider.toUpperCase()}`
                    : 'Built-in Fast AI'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {serverStatus?.backend_ai_configured
                ? 'Backend cloud AI is active from backend/.env. Team members do NOT need to enter personal browser keys—your backend automatically handles AI task parsing for everyone.'
                : 'Fast multilingual AI parsing runs on device with zero latency. Personal keys below are optional and only needed if running in browser-only mode.'}
            </p>
          </div>

          {/* Groq API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Groq API Key (Llama 3.3 70B)</label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Get free key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Gemini API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Google Gemini API Key</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Google AI Studio</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* OpenAI API Key Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">OpenAI API Key (Optional)</label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Push Notifications & Chime Sound */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span>Task Reminders & Push</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : notifPermission === 'denied'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {notifPermission === 'granted' ? 'Enabled' : notifPermission === 'denied' ? 'Blocked' : 'Action Required'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Receive sound chimes and system notifications when tasks with reminders are due.
            </p>

            <div className="flex items-center gap-2 pt-1">
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-medium transition-colors"
                >
                  Enable System Notifications
                </button>
              )}
              <button
                type="button"
                onClick={handleTestChime}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Test reminder chime sound"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Test Sound</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Personal browser keys are optional overrides stored locally and never shared.</span>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all"
            >
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Saved Successfully!</span>
                </>
              ) : (
                <span>Save API Keys</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
