import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return (
    <div className="text-center px-6 py-8 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20">
      <h1 className="text-4xl font-bold text-white mb-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>
        OLLIYARUVI PRINTERS
      </h1>
      <p className="text-white text-lg mb-10 font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
        Billing & Stock Management
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/login"
          className="px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="px-8 py-3 bg-black/80 text-white font-semibold rounded-lg border-2 border-red-600 hover:bg-red-950/60 transition-colors shadow-lg"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
