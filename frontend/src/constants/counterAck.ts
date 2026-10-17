const ACK_AT_KEY = 'oliyaruvi_counter_ack_at';
const ACK_DATE_KEY = 'oliyaruvi_counter_ack_date';

export function clearCounterAck() {
  sessionStorage.removeItem(ACK_AT_KEY);
  sessionStorage.removeItem(ACK_DATE_KEY);
}

export function readCounterAckAt(): number | null {
  const raw = sessionStorage.getItem(ACK_AT_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function readCounterAckDate(): string | null {
  return sessionStorage.getItem(ACK_DATE_KEY);
}

export function writeCounterAck(today: string) {
  sessionStorage.setItem(ACK_AT_KEY, String(Date.now()));
  sessionStorage.setItem(ACK_DATE_KEY, today);
}

export { ACK_AT_KEY, ACK_DATE_KEY };
