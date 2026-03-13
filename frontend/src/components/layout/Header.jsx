export default function Header({ title }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const updatedStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/80 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{dateStr}</span>
          <span>Updated {updatedStr}</span>
        </div>
      </div>
    </header>
  );
}
