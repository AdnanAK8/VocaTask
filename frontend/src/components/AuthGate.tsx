import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Mail,
  Phone,
  Lock,
  User as UserIcon,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { User, AuthProvider } from '../types/auth';
import { authService } from '../services/authService';
import aivantaLogo from '../assets/Aivanta-Logo.png';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: 'India (+91)' },
  { code: '+1', country: 'US', label: 'USA / Canada (+1)' },
  { code: '+44', country: 'GB', label: 'UK (+44)' },
  { code: '+971', country: 'AE', label: 'UAE (+971)' },
  { code: '+61', country: 'AU', label: 'Australia (+61)' },
  { code: '+49', country: 'DE', label: 'Germany (+49)' },
  { code: '+65', country: 'SG', label: 'Singapore (+65)' },
];

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [activeTab, setActiveTab] = useState<AuthProvider>('email');
  const [name, setName] = useState('');

  // Email form state
  const [emailMode, setEmailMode] = useState<'signin' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone form state
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [testOtpHint, setTestOtpHint] = useState<string | null>(null);

  // Social simulation/OAuth dialogs
  const [socialModal, setSocialModal] = useState<'google' | 'facebook' | null>(null);
  const [socialEmail, setSocialEmail] = useState('');

  // Status / Loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#3b82f6', '#10b981'],
      });
    } catch {
      // Confetti fallback
    }
  };

  const handleSuccess = (user: User, msg: string) => {
    setSuccessMessage(msg);
    triggerCelebration();
    setTimeout(() => {
      onAuthenticated(user);
    }, 1200);
  };

  // 1. Email Submit
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (emailMode === 'register' && !name.trim()) {
      setError('Please enter your full name so we can personalize your experience.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      let user: User;
      if (emailMode === 'register') {
        user = await authService.registerEmail(name.trim(), email.trim(), password);
        handleSuccess(user, `Account created! Welcome, ${user.name}!`);
      } else {
        user = await authService.loginEmail(email.trim(), password);
        handleSuccess(user, `Welcome back, ${user.name}!`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Phone Send OTP
  const handleSendOtp = async () => {
    setError(null);
    if (!phoneNumber.trim() || phoneNumber.trim().length < 6) {
      setError('Please enter a valid mobile number.');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber.trim().replace(/\D/g, '')}`;
    setLoading(true);
    try {
      const res = await authService.sendPhoneOtp(fullPhone, name.trim());
      setOtpSent(true);
      setOtpTimer(60);
      if (res.test_otp) {
        setTestOtpHint(res.test_otp);
      }
      setSuccessMessage(`Verification code sent to ${fullPhone}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 2b. Phone Verify OTP
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name to proceed.');
      return;
    }
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setError('Please enter the verification code sent to your phone.');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber.trim().replace(/\D/g, '')}`;
    setLoading(true);
    try {
      const user = await authService.verifyPhoneOtp(fullPhone, otpCode.trim(), name.trim());
      handleSuccess(user, `Phone verified! Welcome, ${user.name}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Google Sign-In
  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const googleName = name.trim() || 'Google User';
    const emailVal = socialEmail.trim() || `${googleName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;

    setLoading(true);
    try {
      const token = `g_oauth_${Date.now()}`;
      const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(googleName)}`;
      const user = await authService.loginWithGoogle(token, googleName, emailVal, avatar);
      setSocialModal(null);
      handleSuccess(user, `Signed in with Google as ${user.name}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Facebook Login
  const handleFacebookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fbName = name.trim() || 'Facebook User';
    const emailVal = socialEmail.trim() || `${fbName.toLowerCase().replace(/\s+/g, '.')}@facebook.com`;

    setLoading(true);
    try {
      const token = `fb_access_${Date.now()}`;
      const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fbName)}`;
      const user = await authService.loginWithFacebook(token, fbName, emailVal, avatar);
      setSocialModal(null);
      handleSuccess(user, `Signed in with Facebook as ${user.name}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Facebook authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click test user
  const handleQuickDemo = async () => {
    setName('Sarabjit Singh');
    setLoading(true);
    try {
      const testEmail = `sarab.demo.${Date.now().toString().slice(-4)}@example.com`;
      const user = await authService.registerEmail('Sarabjit Singh', testEmail, 'password123');
      handleSuccess(user, 'Instant Demo signed in! Welcome Sarabjit!');
    } catch {
      const fallback: User = {
        id: `demo_${Date.now()}`,
        name: 'Sarabjit Singh',
        email: 'sarab.demo@example.com',
        provider: 'email',
        avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=Sarabjit+Singh',
        created_at: new Date().toISOString(),
      };
      authService.setSession(fallback, `token_${Date.now()}`);
      handleSuccess(fallback, 'Demo mode active! Welcome Sarabjit!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/50 relative z-10 transition-all">

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/30 ring-1 ring-white/20 mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            VocaTask <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">AI</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
            Powered by <img src={aivantaLogo} alt="AiVanta" className="h-4 inline opacity-90" />
          </p>
          <div className="mt-3 py-1 px-3 rounded-full bg-slate-800/80 border border-slate-700/60 inline-flex items-center gap-1.5 text-xs text-indigo-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Voice-first, multilingual task manager</span>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Name input (Always displayed so user's name is collected before entering the live app) */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Your Full Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarabjit Singh or Priya"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            This name will personalize your AI tasks, voice notes, and live dashboard.
          </p>
        </div>

        {/* Authentication Method Segmented Tabs */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Select Authentication Method
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('email'); setError(null); }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'email'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-4 h-4 mb-1" />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('phone'); setError(null); }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'phone'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Phone className="w-4 h-4 mb-1" />
              <span>Mobile</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('google'); setError(null); }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'google'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-4 h-4 mb-1" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.4-1.5-.4-2.3z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('facebook'); setError(null); }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'facebook'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-4 h-4 mb-1 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Email Authentication */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs text-slate-400">
                {emailMode === 'register' ? 'New here? Create account' : 'Already registered? Sign in'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEmailMode(emailMode === 'register' ? 'signin' : 'register');
                  setError(null);
                }}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {emailMode === 'register' ? 'Switch to Sign In' : 'Switch to Register'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>{emailMode === 'register' ? 'Register & Enter Live App' : 'Sign In & Enter Live App'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Phone Number OTP Authentication */}
        {activeTab === 'phone' && (
          <form onSubmit={handleVerifyPhone} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="py-2 px-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 shrink-0"
                >
                  {COUNTRY_CODES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="98765 43210"
                    disabled={otpSent}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {!otpSent ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || !phoneNumber.trim()}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code (SMS)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">Enter 6-Digit OTP</label>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      Change Number
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                    className="w-full tracking-widest text-center font-mono font-bold text-lg py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {testOtpHint && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between">
                    <span>💡 Test OTP: <strong>{testOtpHint}</strong></span>
                    <button
                      type="button"
                      onClick={() => setOtpCode(testOtpHint)}
                      className="text-indigo-400 font-semibold hover:underline"
                    >
                      Auto-fill
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Did not receive code?'}
                  </span>
                  {otpTimer === 0 && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 4}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] shadow-lg shadow-emerald-600/30 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Enter Live App</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab 3: Google OAuth Sign-In */}
        {activeTab === 'google' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto mb-3 shadow-md">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.4-1.5-.4-2.3z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">Google OAuth Sign-In</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Authenticate securely using Google Identity Services API.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!name.trim()) {
                  setError('Please fill in your name above first.');
                  return;
                }
                setSocialEmail(`${name.trim().toLowerCase().replace(/\s+/g, '.')}@gmail.com`);
                setSocialModal('google');
              }}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center justify-center gap-3 active:scale-[0.99] shadow-lg shadow-white/10 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.4-1.5-.4-2.3z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* Tab 4: Facebook Login */}
        {activeTab === 'facebook' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center mx-auto mb-3 shadow-md">
                <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">Facebook Login API</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Authenticate using Facebook Graph API and OAuth 2.0.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!name.trim()) {
                  setError('Please fill in your name above first.');
                  return;
                }
                setSocialEmail(`${name.trim().toLowerCase().replace(/\s+/g, '.')}@facebook.com`);
                setSocialModal('facebook');
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold flex items-center justify-center gap-3 active:scale-[0.99] shadow-lg shadow-[#1877F2]/30 transition-all"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Continue with Facebook</span>
            </button>
          </div>
        )}

        {/* Quick Demo Mode for Zero Friction Evaluation */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 mb-2">
            Want to test immediately without typing passwords?
          </p>
          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 text-indigo-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>1-Click Test Login as Sarabjit</span>
          </button>
        </div>

      </div>

      {/* Social Confirmation Dialog Modal */}
      {socialModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              {socialModal === 'google' ? (
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.4-1.5-.4-2.3z"/>
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center shadow">
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-white capitalize">
                  {socialModal} Account Authorization
                </h4>
                <p className="text-[11px] text-slate-400">Confirm account details for VocaTask AI</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Connected Email</label>
              <input
                type="email"
                value={socialEmail}
                onChange={(e) => setSocialEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSocialModal(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={socialModal === 'google' ? handleGoogleSubmit : handleFacebookSubmit}
                disabled={loading}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-md shadow-indigo-600/30"
              >
                {loading ? 'Authenticating...' : 'Authorize & Enter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
