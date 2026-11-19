import { describe, expect, it } from 'vitest';
import { shouldDismiss } from './dismiss';

describe('shouldDismiss', () => {
  it('ignores an upward or null drag, however fast', () => {
    expect(shouldDismiss(0, 5, 400)).toBe(false);
    expect(shouldDismiss(-30, 5, 400)).toBe(false);
  });

  it('closes past a distance that grows with the sheet up to a cap', () => {
    expect(shouldDismiss(95, 0, 400)).toBe(false);
    expect(shouldDismiss(96, 0, 400)).toBe(true);
    expect(shouldDismiss(60, 0, 200)).toBe(true);
    expect(shouldDismiss(50, 0, 200)).toBe(false);
  });

  it('never needs less than a small minimum distance', () => {
    expect(shouldDismiss(39, 0, 40)).toBe(false);
    expect(shouldDismiss(40, 0, 40)).toBe(true);
  });

  it('closes on a short flick', () => {
    expect(shouldDismiss(20, 0.6, 400)).toBe(true);
    expect(shouldDismiss(20, 0.59, 400)).toBe(false);
  });

  it('does not take a wobbling tap for a flick', () => {
    expect(shouldDismiss(3, 2, 400)).toBe(false);
    expect(shouldDismiss(19, 2, 400)).toBe(false);
  });
});
