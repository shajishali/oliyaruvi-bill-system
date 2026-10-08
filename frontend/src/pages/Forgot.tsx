import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isValidEmail } from '../contexts/AuthContext';
import { FORGOT_PASSWORD_EMAIL, setAdminPassword } from '../constants/adminAuth';
import { api } from '../api/client';

export default function Forgot() {
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'resend' | 'gmail' | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (email.trim().toLowerCase() !== FORGOT_PASSWORD_EMAIL.toLowerCase()) {
      setError(`Only ${FORGOT_PASSWORD_EMAIL} can reset password`);
      return;
    }
    setSendingOtp(true);
    try {
      await api.auth.requestOtp(email.trim());
      setStep('otp');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifyingOtp(true);
    try {
      await api.auth.verifyOtp(email.trim(), otp);
      setStep('password');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password and confirmation do not match');
      return;
    }
    setAdminPassword(newPassword);
    setDone(true);
  };

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Forgot Password</h2>

      {step === 'email' && (
        <>
          <p className="text-red-100 text-sm mb-4">Enter the owner email to receive an OTP and set a new admin password.</p>
          {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="e.g. name@example.com"
                required
              />
            </div>
            <button type="submit" disabled={sendingOtp} className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
              {sendingOtp ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <>
          <button type="button" onClick={() => { setStep('email'); setError(''); }} className="text-sm text-red-300 mb-4">← Back</button>
          <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg">
            <p className="text-sm text-emerald-200/90">OTP sent to your email. Check your inbox.</p>
            {otpMethod && (
              <p className="text-xs text-emerald-300/70 mt-1">Sent via {otpMethod === 'resend' ? 'Resend' : 'Gmail App Password'}</p>
            )}
          </div>
          {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Enter OTP</label>
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

      {step === 'password' && (
        <>
          {done ? (
            <p className="text-sm text-emerald-200">Admin password saved. Use it the next time you open Salary or Settings.</p>
          ) : (
            <>
              {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-300"
                    placeholder="Enter new password"
                    minLength={4}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-300"
                    placeholder="Confirm new password"
                    minLength={4}
                    required
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">
                  Reset Password
                </button>
              </form>
            </>
          )}
        </>
      )}

      <p className="mt-4 text-center text-red-100 text-sm">
        <Link to="/" className="text-red-200 hover:text-white font-medium">
          Back to Login
        </Link>
      </p>
    </div>
  );
}
