import { useState } from 'react';
import type { FormEvent } from 'react';
import confetti from 'canvas-confetti';
import { AlertCircle, ArrowRight, CheckCircle2, Lock, Mail, Mic, RefreshCw, ShieldCheck } from 'lucide-react';
import type { User } from '../types/auth';
import { authService } from '../services/authService';
import aivantaLogo from '../assets/Aivanta-Logo.png';
import './AuthGateDesign.css';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
}

type SocialProvider = 'google' | 'facebook';

export const AuthGateDesign = ({ onAuthenticated }: AuthGateProps) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('vocatask_remember_email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem('vocatask_remember_email')));
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const [socialEmail, setSocialEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const finishAuth = (user: User, message: string) => {
    setSuccess(message);
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.65 }, colors: ['#4b6b5b', '#89a595', '#d8b66b'] });
    } catch {
      // Authentication does not depend on the celebration animation.
    }
    window.setTimeout(() => onAuthenticated(user), 900);
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (mode === 'register' && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const user = mode === 'register'
        ? await authService.registerEmail(name.trim(), email.trim(), password)
        : await authService.loginEmail(email.trim(), password);
      if (mode === 'signin') {
        if (remember) localStorage.setItem('vocatask_remember_email', email.trim());
        else localStorage.removeItem('vocatask_remember_email');
      }
      finishAuth(user, mode === 'register' ? `Account created! Welcome, ${user.name}!` : `Welcome back, ${user.name}!`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const submitSocial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!socialProvider) return;
    setError(null);
    setLoading(true);
    const providerName = socialProvider === 'google' ? 'Google' : 'Facebook';
    const accountName = name.trim() || `${providerName} User`;
    const accountEmail = socialEmail.trim() || `${accountName.toLowerCase().replace(/\s+/g, '.')}@${socialProvider === 'google' ? 'gmail.com' : 'facebook.com'}`;
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(accountName)}`;
    try {
      const user = socialProvider === 'google'
        ? await authService.loginWithGoogle(`g_oauth_${Date.now()}`, accountName, accountEmail, avatar)
        : await authService.loginWithFacebook(`fb_access_${Date.now()}`, accountName, accountEmail, avatar);
      setSocialProvider(null);
      finishAuth(user, `Signed in with ${providerName} as ${user.name}!`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : `${providerName} authentication failed.`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((current) => current === 'signin' ? 'register' : 'signin');
    setError(null);
    setPassword('');
  };

  return (
    <main className="auth-page">
      <section className={`auth-card auth-card--${mode}`} aria-labelledby="auth-title">
        <div className="auth-topline">
          <span>{mode === 'signin' ? 'New here?' : 'Already have an account?'}</span>
          <button className="auth-link" type="button" onClick={toggleMode}>{mode === 'signin' ? 'Sign Up' : 'Sign In'}</button>
        </div>

        <header className="auth-heading">
          <div className="auth-mark" aria-hidden="true"><Mic /></div>
          <h1 id="auth-title">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h1>
          <p>{mode === 'signin' ? 'Sign in to your VocaTask account' : 'Create your account and stay organized'}</p>
          <div className="auth-powered"><span>Powered by</span><img src={aivantaLogo} alt="AiVanta" /></div>
        </header>

        {success && <div className="auth-alert auth-alert--success" role="status"><CheckCircle2 />{success}</div>}
        {error && <div className="auth-alert auth-alert--error" role="alert"><AlertCircle />{error}</div>}

        <form className="auth-form" onSubmit={submitEmail}>
          {mode === 'register' && <div className="auth-field">
            <label htmlFor="auth-name">Full Name</label>
            <div className="auth-input-wrap auth-input-wrap--plain"><input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" required /></div>
          </div>}
          <div className="auth-field">
            <label htmlFor="auth-email">Email Address</label>
            <div className="auth-input-wrap"><Mail aria-hidden="true" /><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" required /></div>
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap"><Lock aria-hidden="true" /><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" minLength={6} required /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
            <p className="auth-hint">Use at least 6 characters.</p>
          </div>
          {mode === 'signin' && <div className="auth-options">
            <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Remember me</span></label>
            <button className="auth-link auth-forgot" type="button" onClick={() => setError('Password reset is not available yet. Please contact your administrator.')}>Forgot password?</button>
          </div>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? <><RefreshCw className="auth-spinner" />{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</> : <>{mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight /></>}</button>
        </form>

        {mode === 'signin' && <>
          <div className="auth-divider"><span>OR</span></div>
          <button className="auth-google" type="button" onClick={() => { setSocialEmail(''); setSocialProvider('google'); }}><span className="auth-google-mark" aria-hidden="true">G</span>Continue with Google</button>
          <button className="auth-facebook-link" type="button" onClick={() => { setSocialEmail(''); setSocialProvider('facebook'); }}>Continue with Facebook</button>
        </>}
        <p className="auth-security"><ShieldCheck aria-hidden="true" />Your data is safe and secure</p>
      </section>

      {socialProvider && <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSocialProvider(null); }}>
        <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="social-title">
          <h2 id="social-title">{socialProvider === 'google' ? 'Google' : 'Facebook'} account</h2>
          <p>Confirm the details you want to use for VocaTask.</p>
          <form onSubmit={submitSocial}>
            <div className="auth-field"><label htmlFor="social-name">Account Name</label><input id="social-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required /></div>
            <div className="auth-field"><label htmlFor="social-email">Connected Email</label><input id="social-email" type="email" value={socialEmail} onChange={(event) => setSocialEmail(event.target.value)} placeholder="Enter your email" required /></div>
            <div className="auth-modal-actions"><button className="auth-cancel" type="button" onClick={() => setSocialProvider(null)}>Cancel</button><button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in...' : <>Continue <ArrowRight /></>}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
};