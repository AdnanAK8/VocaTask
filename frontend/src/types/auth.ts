export type AuthProvider = 'email' | 'phone' | 'google' | 'facebook';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  provider: AuthProvider;
  avatar_url?: string | null;
  created_at?: string;
  last_login_at?: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  message?: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  phone: string;
  test_otp?: string;
  expires_in_seconds?: number;
}

export interface AuthConfig {
  google_client_id: string;
  facebook_app_id: string;
  is_development: boolean;
}
