import { describe, expect, it } from 'vitest';
import {
  durationFor,
  formatApiTime,
  formatClock,
  formatHours,
  formatRange,
  parseTime,
  snapMinutes,
} from './planner-time';

describe('parseTime', () => {
  it.each([
    ['00:00', 0],
    ['09:30', 570],
    ['9:30', 570],
    ['23:45', 1425],
    ['14:15:00', 855],
  ])('reads %s as %d minutes', (text, minutes) => {
    expect(parseTime(text)).toBe(minutes);
  });
});

describe('formatting times', () => {
  it('words the clock without a leading zero on the hour', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(540)).toBe('9:00');
    expect(formatClock(1425)).toBe('23:45');
  });

  it('writes the API time with two digits', () => {
    expect(formatApiTime(540)).toBe('09:00');
    expect(formatApiTime(1425)).toBe('23:45');
  });

  it('writes a range with an en dash, or spaced for the panel', () => {
    expect(formatRange(540, 570)).toBe('9:00–9:30');
    expect(formatRange(540, 660, true)).toBe('9:00 – 11:00');
  });
});

describe('snapMinutes', () => {
  it.each([
    [0, 0],
    [7, 0],
    [8, 15],
    [22, 15],
    [23, 30],
    [547, 540],
    [553, 555],
  ])('snaps %d to %d', (minutes, snapped) => {
    expect(snapMinutes(minutes)).toBe(snapped);
  });
});

describe('formatHours', () => {
  it.each([
    [120, '2h'],
    [90, '1,5h'],
    [150, '2,5h'],
    [15, '0,25h'],
    [45, '0,75h'],
    [10, '0,17h'],
    [0, '0h'],
    [600, '10h'],
  ])('words %d minutes as %s', (minutes, text) => {
    expect(formatHours(minutes)).toBe(text);
  });
});

describe('durationFor', () => {
  it('uses what is left to reserve, rounded up to a quarter hour', () => {
    expect(durationFor(150)).toBe(150);
    expect(durationFor(140)).toBe(150);
    expect(durationFor(1)).toBe(15);
  });

  it('falls back to one hour without an estimate or with nothing left', () => {
    expect(durationFor(null)).toBe(60);
    expect(durationFor(0)).toBe(60);
  });

  it('never exceeds the longest block of a day', () => {
    expect(durationFor(3000)).toBe(1425);
  });
});
