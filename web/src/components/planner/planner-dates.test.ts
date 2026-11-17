import { describe, expect, it } from 'vitest';
import { dayLabel, dayNumber, dayRow, deadlineWeekday, weekTitle, WEEKDAYS } from './planner-dates';

describe('weekTitle', () => {
  it('writes the range with the month name', () => {
    expect(weekTitle('2026-11-16')).toBe('16 a 22 de novembro');
  });

  it('names both months when the week crosses a month', () => {
    expect(weekTitle('2026-10-26')).toBe('26 de outubro a 1 de novembro');
  });

  it('names both months when the week crosses a year', () => {
    expect(weekTitle('2026-12-28')).toBe('28 de dezembro a 3 de janeiro');
  });
});

describe('day labels', () => {
  it('lists the weekdays from Monday', () => {
    expect(WEEKDAYS).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
  });

  it('gives the day number', () => {
    expect(dayNumber('2026-11-04')).toBe(4);
    expect(dayNumber('2026-11-22')).toBe(22);
  });

  it('words a day for the panel', () => {
    expect(dayRow('2026-11-04')).toBe('qua, 4 nov');
    expect(dayRow('2026-11-21')).toBe('sáb, 21 nov');
  });

  it('words a day for the column and the strip labels', () => {
    expect(dayLabel('2026-11-17')).toBe('terça-feira, 17 de novembro');
  });

  it('gives the short weekday for a deadline', () => {
    expect(deadlineWeekday('2026-11-19')).toBe('qui');
    expect(deadlineWeekday('2026-11-22')).toBe('dom');
  });
});
