import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCounter } from '../../contexts/CounterContext';

export default function CounterIdentifyHost() {
  const {
    promptOpen,
    promptReason,
    staff,
    loading,
    activeName,
    selectCounterPerson,
    addCounterPerson,
    closePromptIfAllowed,
  } = useCounter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!promptOpen) return null;

  const blocking = promptReason === 'login' || promptReason === 'expired';
  const title =
    promptReason === 'expired'
      ? 'Confirm who is at the counter'
      : promptReason === 'manual'
        ? 'Change who is at the counter'
        : 'Who is at the counter?';
  const subtitle =
    promptReason === 'expired'
      ? 'Every 2 hours, confirm the person working the counter before continuing.'
      : promptReason === 'manual'
        ? 'Select the person who is working now.'
        : 'Enter or choose the name of who is working today before using the system.';

  const pick = async (staffId: number) => {
    setBusy(true);
    setError('');
    try {
      await selectCounterPerson(staffId);
      setName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    setError('');
    try {
      await addCounterPerson(next);
      setName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/85 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-red-950/70 bg-neutral-950 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counter-identify-title"
      >
        <h2 id="counter-identify-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm text-red-200/80">{subtitle}</p>
        {activeName && promptReason !== 'login' && (
          <p className="mt-2 text-xs text-emerald-300/90">
            Currently signed in as counter: <span className="font-semibold">{activeName}</span>
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-red-300">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {staff.length === 0 ? (
                <p className="text-sm text-amber-200">No names yet — add the first person below.</p>
              ) : (
                staff.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void pick(person.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                      activeName === person.name
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-black border-red-900/50 text-red-100 hover:bg-red-950/70'
                    }`}
                  >
                    {person.name}
                  </button>
                ))
              )}
            </div>

            <form onSubmit={(e) => void add(e)} className="mt-4 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Add new name"
                maxLength={40}
                className="flex-1 border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white text-sm placeholder-red-400/50"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="px-3 py-2 rounded-lg bg-red-950/70 text-red-100 text-sm hover:bg-red-900/70 disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {!blocking && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={closePromptIfAllowed}
              className="px-3 py-1.5 rounded-lg text-sm text-red-200 hover:bg-red-950/60"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
