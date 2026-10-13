import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Mail, Phone, ShieldCheck, ChevronDown } from 'lucide-react';
import type { User } from '../types/auth';
import './UserProfileMenu.css';

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
          <span className="profile-provider-badge profile-provider-badge--google">
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
          <span className="profile-provider-badge profile-provider-badge--facebook">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </span>
        );
      case 'phone':
        return (
          <span className="profile-provider-badge profile-provider-badge--phone">
            <Phone className="w-3 h-3" />
            Phone
          </span>
        );
      default:
        return (
          <span className="profile-provider-badge profile-provider-badge--email">
            <Mail className="w-3 h-3" />
            Email
          </span>
        );
    }
  };

  const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : nameParts[0]?.slice(0, 2).toUpperCase() || 'U';
  const customAvatar = user.avatar_url && !user.avatar_url.includes('dicebear.com/7.x/initials')
    ? user.avatar_url
    : null;

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="profile-trigger"
        aria-label="User account menu"
        title={`Logged in as ${user.name}`}
        aria-expanded={isOpen}
      >
        <span className="profile-avatar" aria-hidden="true">
          {customAvatar && (
            <img
              src={customAvatar}
              alt={user.name}
              className="profile-avatar-image"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          )}
          {!customAvatar && initials}
        </span>
        <span className="profile-name">
            {user.name}
        </span>
        <ChevronDown className={`profile-chevron ${isOpen ? 'profile-chevron--open' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-heading">
            <div className="profile-dropdown-name-row">
              <span className="profile-dropdown-name">{user.name}</span>
              {getProviderBadge()}
            </div>
            <p className="profile-contact">
              {user.email && (
                <>
                  <Mail aria-hidden="true" />
                  <span>{user.email}</span>
                </>
              )}
              {user.phone && !user.email && (
                <>
                  <Phone aria-hidden="true" />
                  <span>{user.phone}</span>
                </>
              )}
            </p>
          </div>

          <div className="profile-dropdown-actions">
            <div className="profile-session">
              <ShieldCheck aria-hidden="true" />
              <span>Session Authenticated</span>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="profile-logout"
            >
              <LogOut aria-hidden="true" />
              <span>Log out / Switch account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
