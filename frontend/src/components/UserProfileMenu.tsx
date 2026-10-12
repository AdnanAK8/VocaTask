import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Mail, Phone, ShieldCheck, ChevronDown } from 'lucide-react';
import type { User } from '../types/auth';

interface UserProfileMenuProps {
  user: User;
  onLogout: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getProviderBadge = () => {
    switch (user.provider) {
      case 'google':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
            <svg className="w-3 h-3" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.4-1.5-.4-2.3z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
            </svg>
            Google
          </span>
        );
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </span>
        );
      case 'phone':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <Phone className="w-3 h-3" />
            Phone
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            <Mail className="w-3 h-3" />
            Email
          </span>
        );
    }
  };

  const initials = user.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 hover:border-slate-700 transition-all text-left"
        aria-label="User account menu"
        title={`Logged in as ${user.name}`}
      >
        <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-white/10">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // fallback to initials on error
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="hidden md:flex flex-col">
          <span className="text-xs font-medium text-slate-200 leading-tight max-w-[100px] truncate">
            {user.name}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-3 border-b border-slate-800/80">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-sm font-semibold text-white truncate">{user.name}</span>
              {getProviderBadge()}
            </div>
            <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
              {user.email && (
                <>
                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </>
              )}
              {user.phone && !user.email && (
                <>
                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{user.phone}</span>
                </>
              )}
            </p>
          </div>

          <div className="px-2 py-1.5">
            <div className="px-2.5 py-1.5 text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Session Authenticated</span>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out / Switch account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
