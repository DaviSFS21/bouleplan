import { describe, expect, it } from 'vitest';
import { formatEffort, parseEffort } from './task-effort';

describe('parseEffort', () => {
  it.each([
    ['6', 6],
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['2h', 2],
    ['2 H', 2],
    ['0,25h', 0.25],
    ['999', 999],
    ['  3  ', 3],
  ])('reads %j as %d hours', (text, hours) => {
    expect(parseEffort(text)).toEqual({ valid: true, hours });
  });

  it('reads an empty field as clearing the effort', () => {
    expect(parseEffort('')).toEqual({ valid: true, hours: null });
    expect(parseEffort('   ')).toEqual({ valid: true, hours: null });
  });

  it.each(['abc', '0', '0,00', '1000', '1,555', '-2', '1,5,5', 'h', '1 hora', '.5'])(
    'rejects %j',
    (text) => {
      expect(parseEffort(text)).toEqual({ valid: false });
    },
  );
});

describe('formatEffort', () => {
  it('shows whole hours and a decimal comma', () => {
    expect(formatEffort(6)).toBe('6h');
    expect(formatEffort(1.5)).toBe('1,5h');
    expect(formatEffort(0.25)).toBe('0,25h');
  });

  it('shows nothing without effort', () => {
    expect(formatEffort(null)).toBe('');
  });
});
