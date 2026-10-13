import React, { useState, useEffect } from 'react';
import {
  X, Key, Check, ExternalLink, ShieldCheck, Sparkles,
  Bell, Volume2, Server, User as UserIcon, LogOut
} from 'lucide-react';
import { api } from '../services/api';
import {
  getNotificationPermission,
  requestNotificationPermission,
  playReminderChime,
} from '../services/notificationService';
import type { User } from '../types/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onLogout?: () => void;
}

type TabType = 'keys' | 'notifications' | 'account';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('keys');

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission
  );
  const [serverStatus, setServerStatus] = useState<{
    backend_ai_configured: boolean;
    provider: string;
    has_gemini: boolean;
    has_openai: boolean;
    has_groq: boolean;
    has_elevenlabs?: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getVoiceStatus().then(setServerStatus).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  };

  const keyItems = [
    {
      id: 'gemini',
      name: 'Google Gemini Key',
      prefix: 'AIz',
      isChanged: Boolean(serverStatus?.has_gemini || localStorage.getItem('gemini_api_key')),
      url: 'https://aistudio.google.com/app/apikey',
      urlLabel: 'Google AI Studio',
    },
    {
      id: 'groq',
      name: 'Groq API Key (Llama 3.3 70B)',
      prefix: 'gsk',
      isChanged: Boolean(serverStatus?.has_groq || localStorage.getItem('groq_api_key')),
      url: 'https://console.groq.com/keys',
      urlLabel: 'Get free key',
    },
    {
      id: 'openai',
      name: 'OpenAI API Key (Optional)',
      prefix: 'sk-',
      isChanged: Boolean(serverStatus?.has_openai || localStorage.getItem('openai_api_key')),
      url: 'https://platform.openai.com/api-keys',
      urlLabel: 'OpenAI Console',
    },
    {
      id: 'elevenlabs',
      name: 'ElevenLabs Key (Scribe STT)',
      prefix: 'sk_',
      isChanged: Boolean(serverStatus?.has_elevenlabs || localStorage.getItem('elevenlabs_api_key')),
      url: 'https://elevenlabs.io/app/settings/api-keys',
      urlLabel: 'ElevenLabs Keys',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Short, compact dialog box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Compact Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Settings & API Keys</h3>
              <p className="text-[11px] text-slate-400">Configure AI keys & preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Short Tabs Bar */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('keys')}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'keys'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Keys</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'notifications'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Reminders</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'account'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Account</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-slate-200">
          
          {/* TAB 1: API KEYS (Blurred, non-editable, only 3 letters visible, shows "api keys changed" below if changed) */}
          {activeTab === 'keys' && (
            <div className="space-y-3">
              {/* Compact Backend AI Status */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  {serverStatus?.backend_ai_configured ? (
                    <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}
                  <span className="font-medium text-slate-300">
                    {serverStatus?.backend_ai_configured
                      ? `Backend Cloud AI: ${serverStatus.provider.toUpperCase()}`
                      : 'Built-in Fast Multilingual AI Active'}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    serverStatus?.backend_ai_configured
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {serverStatus?.backend_ai_configured ? 'Server Ready' : 'On-Device'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 px-0.5">
                API keys are configured in code (<code className="text-indigo-300 font-mono">.env</code>). Read-only for security.
              </div>

              {/* Blurred & Non-editable API Keys */}
              <div className="space-y-2.5">
                {keyItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-300">
                          {item.name}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.isChanged ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                          title={item.isChanged ? 'Changed in code' : 'Not configured'}
                        />
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <span>{item.urlLabel}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    {/* Blurred display showing only first 3 letters, non-editable */}
                    <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-xl px-3 py-2 flex items-center select-none cursor-default">
                      <span className="font-mono text-xs font-semibold text-slate-200">
                        {item.prefix}
                      </span>
                      <span className="font-mono text-xs text-slate-500 blur-[3.5px] select-none tracking-widest pl-1 overflow-hidden truncate">
                        ••••••••••••••••••••••••••••••••
                      </span>
                    </div>

                    {/* Status below it: if changed, show "api keys changed"; if not changed, leave as it is */}
                    {item.isChanged && (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium pt-0.5 animate-in fade-in">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>api keys changed</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Keys are loaded securely from backend environment and protected.</span>
              </div>
            </div>
          )}

          {/* TAB 2: REMINDERS & NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <span>Push Reminders & Sounds</span>
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

              <p className="text-xs text-slate-400">
                Receive sound chimes and system notifications when tasks with reminders are due.
              </p>

              <div className="flex items-center gap-2 pt-1">
                {notifPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                  >
                    Enable Notifications
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => playReminderChime()}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Test Sound</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT & LOGOUT */}
          {activeTab === 'account' && (
            <div className="space-y-3">
              {user ? (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{user.name}</p>
                      <p className="text-[11px] text-slate-400">{user.email || user.phone || 'Authenticated'}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize">
                      {user.provider}
                    </span>
                  </div>

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLogout();
                      }}
                      className="w-full py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center text-xs text-slate-400">
                  No active session.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Compact Footer */}
        <div className="p-3 px-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
