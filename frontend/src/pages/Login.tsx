import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/app" replace />;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = login(username, password);
    if (result.success) {
      navigate('/app');
    } else {
      setError(result.error || 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>
      {error && <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-red-200/90 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
            placeholder="Enter your username"
            autoComplete="username"
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
            placeholder="Enter your password"
            required
          />
        </div>
        <Link to="/forgot" className="block text-sm text-red-300 hover:text-red-200 mb-2">
          Forgot password?
        </Link>
        <button type="submit" disabled={submitting} className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-center text-red-200/80 text-sm">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-red-400 hover:text-red-300 font-medium">
          Register
        </Link>
      </p>
    </div>
  );
}
