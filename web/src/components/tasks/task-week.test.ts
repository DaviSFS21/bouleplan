import { describe, expect, it } from 'vitest';
import {
  currentWeekStart,
  isoWeekNumber,
  stepWeek,
  weekDates,
  weekRange,
  weekStartOf,
  weekText,
} from './task-week';

describe('isoWeekNumber', () => {
  it.each([
    ['2026-01-01', 1],
    ['2026-11-16', 47],
    ['2026-11-22', 47],
    ['2026-11-23', 48],
    ['2021-01-03', 53],
    ['2021-01-04', 1],
    ['2024-12-30', 1],
    ['2020-12-28', 53],
  ])('puts %s in week %d', (iso, week) => {
    expect(isoWeekNumber(iso)).toBe(week);
  });
});

describe('currentWeekStart', () => {
  it('is the Monday of the local week', () => {
    expect(currentWeekStart(new Date(2026, 10, 17, 9))).toBe('2026-11-16');
    expect(currentWeekStart(new Date(2026, 10, 16, 0, 5))).toBe('2026-11-16');
    expect(currentWeekStart(new Date(2026, 10, 22, 23, 59))).toBe('2026-11-16');
    expect(currentWeekStart(new Date(2026, 10, 23))).toBe('2026-11-23');
  });
});

describe('stepWeek', () => {
  it('moves by whole weeks across months and years', () => {
    expect(stepWeek('2026-11-16', 1)).toBe('2026-11-23');
    expect(stepWeek('2026-11-16', -1)).toBe('2026-11-09');
    expect(stepWeek('2026-12-28', 1)).toBe('2027-01-04');
    expect(stepWeek('2024-03-04', -1)).toBe('2024-02-26');
  });

  it('refuses to leave years 1 to 9999', () => {
    expect(stepWeek('9999-12-27', 1)).toBeNull();
    expect(stepWeek('0001-01-01', -1)).toBeNull();
    expect(stepWeek('0001-01-08', -1)).toBe('0001-01-01');
  });
});

describe('weekText', () => {
  it('names the ISO week or says it is not planned', () => {
    expect(weekText('2026-11-16')).toBe('Planejada na semana 47');
    expect(weekText(null)).toBe('Não planejada');
  });
});

describe('weekRange', () => {
  it('shows the days of the week, with the month once when it does not change', () => {
    expect(weekRange('2026-11-16')).toBe('16 a 22 nov');
    expect(weekRange('2026-11-30')).toBe('30 nov a 6 dez');
  });
});

describe('weekStartOf', () => {
  it('is the Monday of the week that holds the date', () => {
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  });
});

describe('weekDates', () => {
  it('lists the seven days from Monday, across a month end', () => {
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });
});
