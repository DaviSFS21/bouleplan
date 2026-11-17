import { describe, expect, it } from 'vitest';
import { defaultReviewWeek, isWeekStart, weekOfInstant } from './introspecto-week';

describe('defaultReviewWeek', () => {
  it.each([
    ['Monday', new Date(2026, 10, 23, 9), '2026-11-16'],
    ['Tuesday', new Date(2026, 10, 24, 9), '2026-11-16'],
    ['Wednesday', new Date(2026, 10, 25, 9), '2026-11-16'],
    ['Thursday 23:59', new Date(2026, 10, 26, 23, 59), '2026-11-16'],
    ['Friday 00:00', new Date(2026, 10, 27, 0, 0), '2026-11-23'],
    ['Saturday', new Date(2026, 10, 28, 12), '2026-11-23'],
    ['Sunday 23:59', new Date(2026, 10, 29, 23, 59), '2026-11-23'],
    ['Monday 00:00 after the weekend', new Date(2026, 10, 30, 0, 0), '2026-11-23'],
  ])('on %s reviews the week starting %s', (_day, now, expected) => {
    expect(defaultReviewWeek(now)).toBe(expected);
  });

  it('crosses the year boundary', () => {
    expect(defaultReviewWeek(new Date(2027, 0, 5, 9))).toBe('2026-12-28');
  });

  it('falls back to the current week when there is no earlier week', () => {
    const first = new Date(2026, 0, 1, 12);
    first.setFullYear(1, 0, 4);
    expect(defaultReviewWeek(first)).toBe('0001-01-01');
  });
});

describe('isWeekStart', () => {
  it('accepts only Mondays written as ISO dates', () => {
    expect(isWeekStart('2026-11-16')).toBe(true);
    expect(isWeekStart('2026-11-17')).toBe(false);
    expect(isWeekStart('16/11/2026')).toBe(false);
    expect(isWeekStart('0000-01-03')).toBe(false);
    expect(isWeekStart(null)).toBe(false);
  });
});

describe('weekOfInstant', () => {
  it('uses the local date, not the UTC date', () => {
    // 23:30 on Sunday in São Paulo is already Monday in UTC.
    expect(weekOfInstant('2026-11-22T23:30:00-03:00')).toBe('2026-11-16');
    expect(weekOfInstant('2026-11-23T00:00:00-03:00')).toBe('2026-11-23');
    expect(weekOfInstant('2026-11-16T00:00:00-03:00')).toBe('2026-11-16');
  });
});
