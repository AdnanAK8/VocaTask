import type { User, AuthResponse, OtpResponse, AuthConfig } from '../types/auth';

const TOKEN_KEY = 'vocatask_auth_token';
const USER_KEY = 'vocatask_auth_user';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const API_BASE = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : import.meta.env.DEV
    ? '/api'
    : null;

const getUrl = (path: string): string => API_BASE ? `${API_BASE}${path}` : `/api${path}`;

export const authService = {
  getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setSession(user: User, token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async getConfig(): Promise<AuthConfig> {
    try {
      const res = await fetch(getUrl('/auth/config'));
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not load auth config from backend:', err);
    }
    return {
      google_client_id: localStorage.getItem('google_client_id') || '',
      facebook_app_id: localStorage.getItem('facebook_app_id') || '',
      is_development: true,
    };
  },

  async registerEmail(name: string, email: string, password: string): Promise<User> {
    try {
      const res = await fetch(getUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Registration failed (HTTP ${res.status})`);
      }

      const data: AuthResponse = await res.json();
      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      // If server is unreachable in pure client mode, provide fallback
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const fallbackUser: User = {
          id: `local_${Date.now()}`,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          provider: 'email',
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
          created_at: new Date().toISOString(),
        };
        this.setSession(fallbackUser, `local_token_${Date.now()}`);
        return fallbackUser;
      }
      throw err;
    }
  },

  async loginEmail(email: string, password: string): Promise<User> {
    try {
      const res = await fetch(getUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Login failed (HTTP ${res.status})`);
      }

      const data: AuthResponse = await res.json();
      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        // Fallback for offline local dev
        const stored = this.getStoredUser();
        if (stored && stored.email === email.trim().toLowerCase()) {
          return stored;
        }
        const nameFallback = email.split('@')[0] || 'User';
        const fallbackUser: User = {
          id: `local_${Date.now()}`,
          name: nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1),
          email: email.trim().toLowerCase(),
          provider: 'email',
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameFallback)}`,
          created_at: new Date().toISOString(),
        };
        this.setSession(fallbackUser, `local_token_${Date.now()}`);
        return fallbackUser;
      }
      throw err;
    }
  },

  async sendPhoneOtp(phone: string, name?: string): Promise<OtpResponse> {
    try {
      const res = await fetch(getUrl('/auth/phone/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), name: name?.trim() || null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Failed to send OTP (HTTP ${res.status})`);
      }

      return await res.json();
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        return {
          success: true,
          message: `OTP sent to ${phone}. Valid for 10 minutes.`,
          phone,
          test_otp: '123456',
          expires_in_seconds: 600,
        };
      }
      throw err;
    }
  },

  async verifyPhoneOtp(phone: string, otp: string, name?: string): Promise<User> {
    try {
      const res = await fetch(getUrl('/auth/phone/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim(), name: name?.trim() || null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Phone verification failed (HTTP ${res.status})`);
      }

      const data: AuthResponse = await res.json();
      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const cleanName = name?.trim() || `User ${phone.slice(-4)}`;
        const fallbackUser: User = {
          id: `local_phone_${Date.now()}`,
          name: cleanName,
          phone: phone.trim(),
          provider: 'phone',
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
          created_at: new Date().toISOString(),
        };
        this.setSession(fallbackUser, `local_token_${Date.now()}`);
        return fallbackUser;
      }
      throw err;
    }
  },

  async loginWithGoogle(token: string, name?: string, email?: string, avatarUrl?: string): Promise<User> {
    try {
      const res = await fetch(getUrl('/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          name: name?.trim() || null,
          email: email?.trim() || null,
          avatar_url: avatarUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Google login failed (HTTP ${res.status})`);
      }

      const data: AuthResponse = await res.json();
      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const fallbackName = name?.trim() || 'Google User';
        const fallbackUser: User = {
          id: `local_google_${Date.now()}`,
          name: fallbackName,
          email: email?.trim() || 'user@gmail.com',
          provider: 'google',
          avatar_url: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`,
          created_at: new Date().toISOString(),
        };
        this.setSession(fallbackUser, `local_token_${Date.now()}`);
        return fallbackUser;
      }
      throw err;
    }
  },

  async loginWithFacebook(token: string, name?: string, email?: string, avatarUrl?: string): Promise<User> {
    try {
      const res = await fetch(getUrl('/auth/facebook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          name: name?.trim() || null,
          email: email?.trim() || null,
          avatar_url: avatarUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Facebook login failed (HTTP ${res.status})`);
      }

      const data: AuthResponse = await res.json();
      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const fallbackName = name?.trim() || 'Facebook User';
        const fallbackUser: User = {
          id: `local_fb_${Date.now()}`,
          name: fallbackName,
          email: email?.trim() || 'user@facebook.com',
          provider: 'facebook',
          avatar_url: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`,
          created_at: new Date().toISOString(),
        };
        this.setSession(fallbackUser, `local_token_${Date.now()}`);
        return fallbackUser;
      }
      throw err;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const token = this.getStoredToken();
    const stored = this.getStoredUser();
    if (!token || !stored) return null;

    try {
      const res = await fetch(getUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user: User = await res.json();
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return user;
      }
    } catch {
      // Return cached user if offline
    }
    return stored;
  },

  async logout(): Promise<void> {
    try {
      const token = this.getStoredToken();
      if (token) {
        await fetch(getUrl('/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
      }
    } finally {
      this.clearSession();
    }
  },
};
