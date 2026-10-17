import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import {
  clearCounterAck,
  readCounterAckAt,
  readCounterAckDate,
  writeCounterAck,
} from '../constants/counterAck';
import type { CounterShift, CounterStaff } from '../types';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export type CounterPromptReason = 'login' | 'expired' | 'manual' | null;

export { clearCounterAck };

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shouldAsk(active: CounterShift | null): CounterPromptReason {
  if (!active) return 'login';
  if (String(active.work_date || '').slice(0, 10) !== todayLocal()) return 'login';
  const ackDate = readCounterAckDate();
  const ackAt = readCounterAckAt();
  if (!ackAt || ackDate !== todayLocal()) return 'login';
  if (Date.now() - ackAt >= TWO_HOURS_MS) return 'expired';
  return null;
}

interface CounterContextType {
  active: CounterShift | null;
  staff: CounterStaff[];
  loading: boolean;
  promptOpen: boolean;
  promptReason: CounterPromptReason;
  activeName: string | null;
  refreshCounter: () => Promise<void>;
  openCounterIdentify: (reason?: 'manual' | 'expired') => void;
  selectCounterPerson: (staffId: number) => Promise<void>;
  addCounterPerson: (name: string) => Promise<void>;
  closePromptIfAllowed: () => void;
}

const CounterContext = createContext<CounterContextType | null>(null);

export function CounterProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<CounterShift | null>(null);
  const [staff, setStaff] = useState<CounterStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptReason, setPromptReason] = useState<CounterPromptReason>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNextCheck = useCallback((fromAckAt: number | null) => {
    clearTimer();
    const ackAt = fromAckAt ?? readCounterAckAt();
    if (!ackAt) return;
    const remaining = Math.max(1000, TWO_HOURS_MS - (Date.now() - ackAt));
    timerRef.current = setTimeout(() => {
      setPromptReason('expired');
      setPromptOpen(true);
    }, remaining);
  }, []);

  const applyPrompt = useCallback((nextActive: CounterShift | null, force?: CounterPromptReason) => {
    if (force === 'manual' || force === 'expired') {
      setPromptReason(force);
      setPromptOpen(true);
      return;
    }
    const reason = shouldAsk(nextActive);
    if (reason) {
      setPromptReason(reason);
      setPromptOpen(true);
    } else {
      setPromptOpen(false);
      setPromptReason(null);
      scheduleNextCheck(readCounterAckAt());
    }
  }, [scheduleNextCheck]);

  const refreshCounter = useCallback(async () => {
    setLoading(true);
    try {
      const day = await api.counter.day();
      setStaff(day.staff || []);
      setActive(day.active ?? null);
      applyPrompt(day.active ?? null);
    } catch {
      setStaff([]);
      setActive(null);
      applyPrompt(null);
    } finally {
      setLoading(false);
    }
  }, [applyPrompt]);

  useEffect(() => {
    void refreshCounter();
    return clearTimer;
  }, [refreshCounter]);

  // Re-check when tab becomes visible again (sleep / overnight).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const reason = shouldAsk(active);
      if (reason) {
        setPromptReason(reason);
        setPromptOpen(true);
      } else {
        scheduleNextCheck(readCounterAckAt());
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active, scheduleNextCheck]);

  const openCounterIdentify = useCallback((reason: 'manual' | 'expired' = 'manual') => {
    setPromptReason(reason);
    setPromptOpen(true);
  }, []);

  const selectCounterPerson = useCallback(async (staffId: number) => {
    // Always confirm from the gate so same-person / overnight shifts get a fresh acknowledgment.
    const result = await api.counter.start(staffId, { renew: true, confirm: true });
    setActive(result.active);
    writeCounterAck(todayLocal());
    setPromptOpen(false);
    setPromptReason(null);
    scheduleNextCheck(Date.now());
    try {
      const day = await api.counter.day();
      setStaff(day.staff || []);
      setActive(day.active ?? result.active);
    } catch {
      // Keep the acknowledgment even if the follow-up refresh fails.
    }
  }, [scheduleNextCheck]);

  const addCounterPerson = useCallback(async (name: string) => {
    await api.counter.addStaff(name.trim());
    const day = await api.counter.day();
    setStaff(day.staff || []);
    setActive(day.active ?? null);
  }, []);

  const closePromptIfAllowed = useCallback(() => {
    // Blocking: only allow close when already identified and not expired.
    if (shouldAsk(active)) return;
    setPromptOpen(false);
    setPromptReason(null);
  }, [active]);

  return (
    <CounterContext.Provider
      value={{
        active,
        staff,
        loading,
        promptOpen,
        promptReason,
        activeName: active?.staff_name ?? null,
        refreshCounter,
        openCounterIdentify,
        selectCounterPerson,
        addCounterPerson,
        closePromptIfAllowed,
      }}
    >
      {children}
    </CounterContext.Provider>
  );
}

export function useCounter() {
  const ctx = useContext(CounterContext);
  if (!ctx) throw new Error('useCounter must be used within CounterProvider');
  return ctx;
}
