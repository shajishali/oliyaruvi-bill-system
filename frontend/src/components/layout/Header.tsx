import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { clearCounterAck } from '../../constants/counterAck';
import { useCounter } from '../../contexts/CounterContext';
import { api } from '../../api/client';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { logout } = useAuth();
  const { activeName, openCounterIdentify } = useCounter();
  const navigate = useNavigate();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const updatedStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleLogout = () => {
    void api.counter.end().catch(() => undefined);
    clearCounterAck();
    logout();
    navigate('/');
  };

  return (
    <header className="bg-black/90 backdrop-blur-sm border-b border-red-950/60 px-6 py-3 shadow-lg shrink-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-3 text-sm text-red-200/80 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => openCounterIdentify('manual')}
            className="px-3 py-1.5 rounded-lg border border-red-900/50 bg-black/50 hover:bg-red-950/60 text-left"
            title="Confirm or change who is at the counter"
          >
            <span className="text-red-300/80 text-xs block leading-none mb-0.5">At counter</span>
            <span className="text-white font-medium">{activeName || 'Choose name'}</span>
          </button>
          <span className="hidden sm:inline">{dateStr}</span>
          <span className="hidden md:inline">Updated {updatedStr}</span>
          <button onClick={handleLogout} className="px-3 py-1.5 bg-red-950/60 rounded-lg hover:bg-red-900/70 text-red-200">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
