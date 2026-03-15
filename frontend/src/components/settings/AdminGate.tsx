import { useState, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ADMIN_USERNAME,
  ADMIN_DEFAULT_PASSWORD,
  FORGOT_PASSWORD_EMAIL,
  ADMIN_AUTH_KEY,
  ADMIN_PASSWORD_KEY,
} from '../../constants/adminAuth';
import { api } from '../../api/client';

function getStoredPassword(): string {
  try {
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || ADMIN_DEFAULT_PASSWORD;
  } catch {
    return ADMIN_DEFAULT_PASSWORD;
  }
}

function setStoredPassword(p: string) {
  localStorage.setItem(ADMIN_PASSWORD_KEY, p);
}

type Step = 'login' | 'forgot_email' | 'forgot_otp' | 'forgot_password';

export default function AdminGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('login');

  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'resend' | 'gmail' | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAuthenticated(sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true');
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const stored = getStoredPassword();
    if (username.trim() !== ADMIN_USERNAME) {
      setError('Invalid username');
      return;
    }
    if (password !== stored) {
      setError('Invalid password');
      return;
    }
    setSubmitting(true);
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    setAuthenticated(true);
  };

  const handleForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (forgotEmail.trim().toLowerCase() !== FORGOT_PASSWORD_EMAIL.toLowerCase()) {
      setError(`Only ${FORGOT_PASSWORD_EMAIL} can reset password`);
      return;
    }
    setSendingOtp(true);
    try {
      await api.auth.requestOtp(forgotEmail.trim());
      setOtpSent(true);
      setStep('forgot_otp');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifyingOtp(true);
    try {
      await api.auth.verifyOtp(forgotEmail.trim(), otp);
      setStep('forgot_password');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    setSubmitting(true);
    setStoredPassword(newPassword);
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    setAuthenticated(true);
    setStep('login');
    setForgotEmail('');
    setOtp('');
    setNewPassword('');
  };

  if (authenticated) return <>{children}</>;

  const modal = (
    <div className="fixed inset-0 left-52 flex items-center justify-center z-50 p-6">
      <div className="max-w-md w-full bg-black/95 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl relative">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="absolute top-4 right-4 p-1.5 rounded text-red-300 hover:bg-red-950/60 hover:text-white"
          title="Close"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-white mb-4 text-center">Settings - Owner Login</h2>
        <p className="text-sm text-red-300/70 mb-4 text-center">
          Enter admin credentials to access Settings and Reports.
        </p>

        {step === 'login' && (
          <>
            {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="admin"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="••••"
                  required
                />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Login
              </button>
            </form>
            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setStep('forgot_email'); setError(''); }}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Forgot password?
              </button>
            </p>
            <p className="mt-3 text-center">
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="text-sm text-red-300/80 hover:text-red-200"
              >
                ← Back to Dashboard
              </button>
            </p>
          </>
        )}

        {step === 'forgot_email' && (
          <>
            <button type="button" onClick={() => setStep('login')} className="text-sm text-red-300 mb-4">← Back</button>
            {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleForgotEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="Enter owner email"
                  required
                />
              </div>
              <button type="submit" disabled={sendingOtp} className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {sendingOtp ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {step === 'forgot_otp' && (
          <>
            <button type="button" onClick={() => { setStep('forgot_email'); setOtp(''); }} className="text-sm text-red-300 mb-4">← Back</button>
            {otpSent && (
              <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg">
                <p className="text-sm text-emerald-200/90">OTP sent to your email. Check your inbox.</p>
                {otpMethod && (
                  <p className="text-xs text-emerald-300/70 mt-1">Sent via {otpMethod === 'resend' ? 'Resend' : 'Gmail App Password'}</p>
                )}
              </div>
            )}
            {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 text-center text-lg tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" disabled={verifyingOtp} className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          </>
        )}

        {step === 'forgot_password' && (
          <>
            {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="Enter new password"
                  minLength={4}
                  required
                />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Reset Password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
