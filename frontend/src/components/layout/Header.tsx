import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const updatedStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-black/90 backdrop-blur-sm border-b border-red-950/60 px-6 py-3 shadow-lg shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-4 text-sm text-red-200/80">
          <span>{dateStr}</span>
          <span>Updated {updatedStr}</span>
          <button onClick={handleLogout} className="px-3 py-1.5 bg-red-950/60 rounded-lg hover:bg-red-900/70 text-red-200">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
