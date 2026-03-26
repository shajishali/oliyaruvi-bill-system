import type { FocusEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';

/** Select whole value on focus when empty or default "0" so the next key replaces it. */
export function selectIfEmptyOrZero(e: FocusEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const v = el.value.trim();
  if (v !== '' && v !== '0') return;
  requestAnimationFrame(() => {
    el.select();
  });
}

/** Avoid clearing selection on mouseup after focus-select (browser quirk). */
export function preventMouseUpWhenSelecting(e: MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const v = el.value.trim();
  if (document.activeElement === el && (v === '' || v === '0')) {
    e.preventDefault();
  }
}

/** Enter moves to next field instead of submitting the form (multi-field modals). */
export function focusNextOnEnter(
  e: KeyboardEvent<HTMLInputElement>,
  next: RefObject<HTMLInputElement | null>
) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
  e.preventDefault();
  requestAnimationFrame(() => next.current?.focus());
}
