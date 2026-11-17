import { afterEach, describe, expect, it } from 'vitest';
import { deadlineLabel } from './task-deadline';

// Thursday, 5 Nov 2026, late in the evening: the local date decides, not the UTC one.
const NOW = new Date(2026, 10, 5, 23, 30);

describe('deadlineLabel', () => {
  it.each([
    [null, 'sem prazo'],
    ['2026-11-05', 'vence hoje'],
    ['2026-11-06', 'vence amanhã'],
    ['2026-11-04', 'venceu ontem'],
    ['2026-11-03', 'venceu ter, 3 nov'],
    ['2026-11-07', 'vence sáb, 7 nov'],
    ['2026-12-31', 'vence qui, 31 dez'],
    ['2027-01-04', 'vence seg, 4 jan 2027'],
  ])('words %s as "%s"', (deadline, text) => {
    expect(deadlineLabel(deadline, NOW, false).text).toBe(text);
  });

  it.each([
    [null, false],
    ['2026-10-01', true],
    ['2026-11-04', true],
    ['2026-11-05', true],
    ['2026-11-06', true],
    ['2026-11-07', false],
    ['2027-11-07', false],
  ])('alerts for %s: %s', (deadline, alert) => {
    expect(deadlineLabel(deadline, NOW, false).alert).toBe(alert);
  });

  it('never alerts for a done task but keeps the wording', () => {
    expect(deadlineLabel('2026-11-04', NOW, true)).toEqual({ text: 'venceu ontem', alert: false });
    expect(deadlineLabel('2026-11-05', NOW, true)).toEqual({ text: 'vence hoje', alert: false });
  });

  it('counts calendar days across a daylight saving change', () => {
    const march = new Date(2026, 2, 7, 12);
    expect(deadlineLabel('2026-03-08', march, false).text).toBe('vence amanhã');
    expect(deadlineLabel('2026-03-09', march, false).text).toBe('vence seg, 9 mar');
  });
});

describe('time zones', () => {
  const original = process.env.TZ;

  afterEach(() => {
    process.env.TZ = original;
  });

  it('runs the suite in São Paulo, three hours behind UTC', () => {
    expect(process.env.TZ).toBe('America/Sao_Paulo');
    expect(new Date(2026, 10, 5).getTimezoneOffset()).toBe(180);
  });

  it('uses the local date, not the UTC one', () => {
    // 23:30 in São Paulo is already 6 Nov in UTC.
    expect(NOW.toISOString().slice(0, 10)).toBe('2026-11-06');
    expect(deadlineLabel('2026-11-05', NOW, false).text).toBe('vence hoje');
    expect(deadlineLabel('2026-11-06', NOW, false).text).toBe('vence amanhã');
  });

  it('counts calendar days across a daylight saving change', () => {
    process.env.TZ = 'America/New_York';
    const eve = new Date(2026, 2, 7, 23, 30);

    expect(deadlineLabel('2026-03-08', eve, false).text).toBe('vence amanhã');
    expect(deadlineLabel('2026-03-09', eve, false).text).toBe('vence seg, 9 mar');
    expect(deadlineLabel('2026-03-07', eve, false).text).toBe('vence hoje');
  });
});
