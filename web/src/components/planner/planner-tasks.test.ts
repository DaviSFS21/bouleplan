import { describe, expect, it } from 'vitest';
import { task } from '@/test/fixtures';
import {
  atRiskTasks,
  isAtRisk,
  missingByDeadline,
  remainingLabel,
  remainingMinutes,
  reservedOf,
  riskLabel,
  stripTotal,
  trayMeta,
  trayTasks,
} from './planner-tasks';

const TODAY = '2026-11-17';
const WEEK_END = '2026-11-22';

describe('reservedOf', () => {
  it('reads the reserved minutes of the task', () => {
    expect(reservedOf(task({ reservedMinutes: 90, reservedByDeadlineMinutes: 30 }))).toEqual({
      total: 90,
      byDeadline: 30,
    });
  });
});

describe('remainingMinutes', () => {
  it('is the estimate minus every block, never below zero', () => {
    expect(remainingMinutes(task({ estimatedEffort: 6, reservedMinutes: 210 }))).toBe(150);
    expect(remainingMinutes(task({ estimatedEffort: 2, reservedMinutes: 0 }))).toBe(120);
    expect(remainingMinutes(task({ estimatedEffort: 2, reservedMinutes: 180 }))).toBe(0);
  });

  it('is null without an estimate', () => {
    expect(remainingMinutes(task({ estimatedEffort: null }))).toBeNull();
  });

  it('rounds fractional hours to the minute', () => {
    expect(remainingMinutes(task({ estimatedEffort: 0.01, reservedMinutes: 0 }))).toBe(1);
  });
});

describe('remainingLabel', () => {
  it.each([
    [task({ estimatedEffort: 2 }), '2h'],
    [task({ estimatedEffort: 3, reservedMinutes: 90 }), '1,5h'],
    [task({ estimatedEffort: null }), 'sem estimativa'],
    [task({ estimatedEffort: 1, reservedMinutes: 60 }), 'tudo reservado'],
  ])('words the ficha of %#', (item, text) => {
    expect(remainingLabel(item)).toBe(text);
  });
});

describe('trayMeta', () => {
  it.each([
    [task({ estimatedEffort: 6, reservedMinutes: 210 }), '2,5h a reservar de 6h'],
    [task({ estimatedEffort: 2 }), '2h a reservar'],
    [task({ estimatedEffort: null }), 'sem estimativa'],
    [task({ estimatedEffort: 2, reservedMinutes: 120 }), 'tudo reservado'],
  ])('words the tray item of %#', (item, text) => {
    expect(trayMeta(item)).toBe(text);
  });
});

describe('isAtRisk', () => {
  const base = { deadline: '2026-11-19', estimatedEffort: 4 };

  it('flags an estimate that is not fully reserved by the deadline', () => {
    expect(isAtRisk(task({ ...base, reservedByDeadlineMinutes: 120 }), TODAY, WEEK_END)).toBe(true);
    expect(isAtRisk(task({ ...base, reservedByDeadlineMinutes: 0 }), TODAY, WEEK_END)).toBe(true);
  });

  it('is calm once the whole estimate is reserved by the deadline', () => {
    expect(isAtRisk(task({ ...base, reservedByDeadlineMinutes: 240 }), TODAY, WEEK_END)).toBe(
      false,
    );
    expect(isAtRisk(task({ ...base, reservedByDeadlineMinutes: 300 }), TODAY, WEEK_END)).toBe(
      false,
    );
  });

  it('does not count blocks after the deadline', () => {
    expect(
      isAtRisk(
        task({ ...base, reservedMinutes: 240, reservedByDeadlineMinutes: 60 }),
        TODAY,
        WEEK_END,
      ),
    ).toBe(true);
  });

  it('flags a task without an estimate only while nothing is reserved by the deadline', () => {
    const open = { deadline: '2026-11-19', estimatedEffort: null };
    expect(isAtRisk(task({ ...open, reservedByDeadlineMinutes: 0 }), TODAY, WEEK_END)).toBe(true);
    expect(isAtRisk(task({ ...open, reservedByDeadlineMinutes: 15 }), TODAY, WEEK_END)).toBe(false);
  });

  it('counts a deadline today and one on the last day of the week', () => {
    expect(isAtRisk(task({ ...base, deadline: TODAY }), TODAY, WEEK_END)).toBe(true);
    expect(isAtRisk(task({ ...base, deadline: WEEK_END }), TODAY, WEEK_END)).toBe(true);
  });

  it('leaves out overdue, later and missing deadlines', () => {
    expect(isAtRisk(task({ ...base, deadline: '2026-11-16' }), TODAY, WEEK_END)).toBe(false);
    expect(isAtRisk(task({ ...base, deadline: '2026-11-23' }), TODAY, WEEK_END)).toBe(false);
    expect(isAtRisk(task({ ...base, deadline: null }), TODAY, WEEK_END)).toBe(false);
  });

  it('leaves out done tasks', () => {
    expect(isAtRisk(task({ ...base, status: 'done' }), TODAY, WEEK_END)).toBe(false);
  });

  it('works for a week that ends before today', () => {
    expect(isAtRisk(task(base), TODAY, '2026-11-15')).toBe(false);
  });
});

describe('missingByDeadline and riskLabel', () => {
  it('counts what the deadline still lacks', () => {
    expect(missingByDeadline(task({ estimatedEffort: 4, reservedByDeadlineMinutes: 120 }))).toBe(
      120,
    );
    expect(missingByDeadline(task({ estimatedEffort: null }))).toBeNull();
  });

  it('words the shortage', () => {
    expect(riskLabel(task({ estimatedEffort: 4, reservedByDeadlineMinutes: 120 }))).toBe(
      'faltam 2h',
    );
    expect(riskLabel(task({ estimatedEffort: null }))).toBe('sem tempo reservado');
  });
});

describe('atRiskTasks', () => {
  it('lists the tasks at risk', () => {
    const risky = task({ id: 'a', deadline: '2026-11-18', estimatedEffort: 2 });
    const calm = task({
      id: 'b',
      deadline: '2026-11-18',
      reservedByDeadlineMinutes: 120,
      estimatedEffort: 2,
    });
    expect(atRiskTasks([risky, calm], TODAY, WEEK_END)).toEqual([risky]);
  });
});

describe('trayTasks', () => {
  const week = '2026-11-16';
  const p2 = task({ id: 'p2', priority: 'P2', deadline: '2026-11-30' });
  const p1Late = task({ id: 'p1-late', priority: 'P1', deadline: '2026-12-10' });
  const p1Soon = task({ id: 'p1-soon', priority: 'P1', deadline: '2026-11-20' });
  const p1None = task({ id: 'p1-none', priority: 'P1', deadline: null });
  const planned = task({ id: 'planned', priority: 'P3', plannedWeekStart: week });
  const done = task({ id: 'done', status: 'done' });
  const doing = task({ id: 'doing', priority: 'P3', status: 'in_progress' });
  const other = task({ id: 'other', initiativeId: 'ini-2', priority: 'P1' });

  it('puts the planned ones first, then priority, then nearest deadline, none last', () => {
    const ids = trayTasks([p2, p1None, p1Late, planned, p1Soon, done, doing], week, null, []).map(
      ({ id }) => id,
    );
    expect(ids).toEqual(['planned', 'p1-soon', 'p1-late', 'p1-none', 'p2', 'doing']);
  });

  it('does not put a task planned for another week first', () => {
    const later = task({ id: 'later', priority: 'P3', plannedWeekStart: '2026-11-23' });
    expect(trayTasks([later, p2], week, null, []).map(({ id }) => id)).toEqual(['p2', 'later']);
  });

  it('filters by initiative', () => {
    expect(trayTasks([p2, other], week, 'ini-2', []).map(({ id }) => id)).toEqual(['other']);
  });

  it('filters by the tasks at risk', () => {
    expect(trayTasks([p2, other], week, 'risk', [other]).map(({ id }) => id)).toEqual(['other']);
  });

  it('keeps a stable order for equal tasks', () => {
    const first = task({ id: 'a', createdAt: '2026-01-01T10:00:00-03:00' });
    const second = task({ id: 'b', createdAt: '2026-01-02T10:00:00-03:00' });
    expect(trayTasks([second, first], week, null, []).map(({ id }) => id)).toEqual(['a', 'b']);
  });
});

describe('stripTotal', () => {
  it('is "sem horário" when empty', () => {
    expect(stripTotal([])).toEqual({ text: 'sem horário', extra: null });
  });

  it('sums what is left to reserve and counts the tasks without an estimate', () => {
    const items = [
      task({ estimatedEffort: 2 }),
      task({ estimatedEffort: 3, reservedMinutes: 90 }),
      task({ estimatedEffort: null }),
    ];
    expect(stripTotal(items)).toEqual({ text: '3,5h sem horário', extra: '+1 sem estimativa' });
  });

  it('leaves out the sum when nothing is left to reserve', () => {
    expect(stripTotal([task({ estimatedEffort: 1, reservedMinutes: 60 })])).toEqual({
      text: 'sem horário',
      extra: null,
    });
    expect(stripTotal([task({ estimatedEffort: null })])).toEqual({
      text: 'sem horário',
      extra: '+1 sem estimativa',
    });
  });
});
