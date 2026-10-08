import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, isValidEmail } from '../contexts/AuthContext';
import { FORGOT_PASSWORD_EMAIL } from '../constants/adminAuth';
import { api } from '../api/client';
import ShopLogo from '../components/ShopLogo';

type ModalView = 'login' | 'forgot';
type ForgotStep = 'email' | 'otp' | 'password';

export default function Home() {
  const { isAuthenticated, hasUsers, hasUserWithEmail, login, register, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [modalView, setModalView] = useState<ModalView>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Register form state (first-time only)
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  if (isAuthenticated) return <Navigate to="/app" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    const result = login(loginUsername, loginPassword);
    if (result.success) {
      try {
        await api.reports.logActivity('user_login', { username: loginUsername.trim() });
      } catch (_) {}
      navigate('/app');
    } else {
      setLoginError(result.error || 'Login failed');
      setLoginSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (password !== confirmPassword) {
      setRegError('Passwords do not match');
      return;
    }
    if (!branchName.trim()) {
      setRegError('Branch name is required');
      return;
    }
    setRegSubmitting(true);
    try {
      await api.settings.setBranchName(branchName.trim());
    } catch (err) {
      setRegError((err as Error).message);
      setRegSubmitting(false);
      return;
    }
    const result = register(name, username, password);
    if (result.success) {
      try {
        await api.reports.logActivity('user_registered', { username: username.trim(), name: name.trim() });
      } catch (_) {}
      navigate('/app');
    } else {
      setRegError(result.error || 'Registration failed');
      setRegSubmitting(false);
    }
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!isValidEmail(forgotEmail)) {
      setForgotError('Please enter a valid email address');
      return;
    }
    const isAllowedResetEmail = forgotEmail.trim().toLowerCase() === FORGOT_PASSWORD_EMAIL.toLowerCase();
    if (!hasUserWithEmail(forgotEmail) && !isAllowedResetEmail) {
      setForgotError('No account found with this email.');
      return;
    }
    setForgotSubmitting(true);
    try {
      await api.auth.requestOtp(forgotEmail.trim(), true);
      setForgotStep('otp');
    } catch (err) {
      setForgotError((err as Error).message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSubmitting(true);
    try {
      await api.auth.verifyOtp(forgotEmail.trim(), forgotOtp);
      setForgotStep('password');
    } catch (err) {
      setForgotError((err as Error).message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match');
      return;
    }
    setForgotSubmitting(true);
    const result = resetPassword(forgotEmail, newPassword);
    if (result.success) {
      try {
        await api.reports.logActivity('password_changed', { email: forgotEmail.trim() });
      } catch (_) {}
      setForgotSuccess(true);
      setTimeout(() => {
        setModalView('login');
        setForgotStep('email');
        setForgotEmail('');
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setForgotSuccess(false);
      }, 1500);
    } else {
      setForgotError(result.error || 'Reset failed');
    }
    setForgotSubmitting(false);
  };

  const resetForgotState = () => {
    setModalView('login');
    setForgotStep('email');
    setForgotEmail('');
    setForgotOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotError('');
  };

  const cardClass = 'bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl';
  const inputClass = 'w-full border border-red-900/50 rounded-lg px-3 py-1.5 bg-black/60 text-white placeholder-red-400/50 text-sm';
  const labelClass = 'block text-sm font-medium text-white mb-0.5';
  const btnPrimary = 'w-full py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="text-center px-6 py-5 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20">
      <div className="flex justify-center mb-3">
        <ShopLogo className="h-16 w-auto object-contain drop-shadow" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>
        OLIYARUVI PRINTERS
      </h1>
      <p className="text-white text-lg mb-5 font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
        Billing & Stock Management
      </p>

      {/* First-time: Register form */}
      {!hasUsers && (
        <div className={cardClass} style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2 className="text-xl font-bold text-white mb-2 text-center">Create Account</h2>
          <p className="text-red-100 text-sm mb-3">First time setup. Register to get started.</p>
          {regError && <div className="mb-3 p-2 bg-red-950/80 text-red-200 rounded-lg text-sm">{regError}</div>}
          <form onSubmit={handleRegister} className="space-y-2.5">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Branch name</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Main branch"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="e.g. shaji"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Confirm your password"
                required
              />
            </div>
            <button type="submit" disabled={regSubmitting} className={btnPrimary}>
              {regSubmitting ? 'Registering...' : 'Register & Start'}
            </button>
          </form>
        </div>
      )}

      {/* Returning user: Login modal */}
      {hasUsers && (
        <div className={cardClass} style={{ maxWidth: '400px', margin: '0 auto' }}>
          {modalView === 'login' ? (
            <>
              <h2 className="text-xl font-bold text-white mb-3 text-center">Login</h2>
              {loginError && <div className="mb-3 p-2 bg-red-950/80 text-red-200 rounded-lg text-sm">{loginError}</div>}
              <form onSubmit={handleLogin} className="space-y-2.5">
                <div>
                  <label className={labelClass}>Username</label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className={inputClass}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setModalView('forgot')}
                  className="block text-sm text-red-300 hover:text-red-200 mb-2"
                >
                  Forgot password?
                </button>
                <button type="submit" disabled={loginSubmitting} className={btnPrimary}>
                  {loginSubmitting ? 'Logging in...' : 'Login'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-3 text-center">Forgot Password</h2>
              {forgotSuccess ? (
                <div className="py-3 px-4 bg-emerald-950/50 border border-emerald-500/30 rounded-lg text-emerald-200 text-sm">
                  Password reset successfully. Redirecting to login...
                </div>
              ) : forgotStep === 'email' ? (
                <>
                  <p className="text-red-100 text-sm mb-3">Enter your registered email to receive OTP.</p>
                  {forgotError && <div className="mb-3 p-2 bg-red-950/80 text-red-200 rounded text-sm">{forgotError}</div>}
                  <form onSubmit={handleForgotEmailSubmit} className="space-y-3">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. name@example.com"
                        required
                      />
                    </div>
                    <button type="submit" disabled={forgotSubmitting} className={`${btnPrimary} py-2.5`}>
                      {forgotSubmitting ? 'Sending...' : 'Send OTP'}
                    </button>
                  </form>
                </>
              ) : forgotStep === 'otp' ? (
                <>
                  <button type="button" onClick={() => { setForgotStep('email'); setForgotError(''); }} className="text-xs text-red-300 hover:text-red-200 mb-2">← Back</button>
                  <p className="text-emerald-200/90 text-sm mb-3">OTP sent to your email. Check your inbox.</p>
                  {forgotError && <div className="mb-3 p-2 bg-red-950/80 text-red-200 rounded text-sm">{forgotError}</div>}
                  <form onSubmit={handleForgotOtpSubmit} className="space-y-3">
                    <div>
                      <label className={labelClass}>Enter OTP</label>
                      <input
                        type="text"
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`${inputClass} text-center text-lg tracking-widest`}
                        placeholder="000000"
                        maxLength={6}
                        required
                      />
                    </div>
                    <button type="submit" disabled={forgotSubmitting} className={`${btnPrimary} py-2.5`}>
                      {forgotSubmitting ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setForgotStep('otp'); setForgotError(''); }} className="text-xs text-red-300 hover:text-red-200 mb-2">← Back</button>
                  <p className="text-red-100 text-sm mb-3">Set your new password.</p>
                  {forgotError && <div className="mb-3 p-2 bg-red-950/80 text-red-200 rounded text-sm">{forgotError}</div>}
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                    <div>
                      <label className={labelClass}>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass}
                        placeholder="At least 6 characters"
                        minLength={6}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className={inputClass}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                    <button type="submit" disabled={forgotSubmitting} className={`${btnPrimary} py-2.5`}>
                      {forgotSubmitting ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </form>
                </>
              )}
              <button
                type="button"
                onClick={resetForgotState}
                className="mt-3 block w-full text-xs text-red-400 hover:text-red-300 font-medium"
              >
                ← Back to Login
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
