export const FLICK_VELOCITY = 0.6;
const DISMISS_DISTANCE = 96;
const MIN_DISTANCE = 40;
const DISMISS_FRACTION = 0.3;

// Offset in px, velocity in px/ms, both downward positive.
export function shouldDismiss(offset: number, velocity: number, height: number): boolean {
  if (offset <= 0) return false;
  const distance = Math.min(DISMISS_DISTANCE, Math.max(MIN_DISTANCE, height * DISMISS_FRACTION));
  return offset >= distance || velocity >= FLICK_VELOCITY;
}
