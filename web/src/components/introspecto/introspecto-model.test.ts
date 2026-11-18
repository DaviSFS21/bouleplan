import { describe, expect, it } from 'vitest';
import { task } from '@/test/fixtures';
import {
  buildPlan,
  deadlineText,
  leftBehind,
  rememberLeft,
  isPlanned,
  planChange,
  summarize,
  tallyText,
  trayCounter,
  groupCounter,
} from './introspecto-model';

const WEEK = '2026-11-16';
const NEXT = '2026-11-23';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function make(id: number, overrides: Parameters<typeof task>[0] = {}) {
  return task({ id: `a1a1a1a1-0000-4000-8000-${String(id).padStart(12, '0')}`, ...overrides });
}

describe('summarize', () => {
  it('lists done tasks planned for the week, or touched inside it, and open ones planned for it', () => {
    const planned = make(1, { status: 'done', plannedWeekStart: WEEK });
    const touched = make(2, { status: 'done', updatedAt: '2026-11-18T09:00:00-03:00' });
    const before = make(3, { status: 'done', updatedAt: '2026-11-15T23:59:00-03:00' });
    const after = make(4, { status: 'done', updatedAt: '2026-11-23T00:00:00-03:00' });
    const left = make(5, { plannedWeekStart: WEEK, status: 'in_progress' });
    const elsewhere = make(6, { plannedWeekStart: NEXT });
    const loose = make(7);

    const { done, behind } = summarize(
      [planned, touched, before, after, left, elsewhere, loose],
      WEEK,
    );

    expect(done.map(({ id }) => id)).toEqual([planned.id, touched.id]);
    expect(behind.map(({ id }) => id)).toEqual([left.id]);
  });

  it('uses the local week of updatedAt at the Sunday-Monday boundary', () => {
    const lateSunday = make(1, { status: 'done', updatedAt: '2026-11-22T23:30:00-03:00' });
    const earlyMonday = make(2, { status: 'done', updatedAt: '2026-11-23T00:30:00-03:00' });

    expect(summarize([lateSunday, earlyMonday], WEEK).done.map(({ id }) => id)).toEqual([
      lateSunday.id,
    ]);
  });

  it('never lists a task twice, even when it is planned and touched in the week', () => {
    const both = make(1, {
      status: 'done',
      plannedWeekStart: WEEK,
      updatedAt: '2026-11-18T09:00:00-03:00',
    });

    const { done, behind } = summarize([both], WEEK);

    expect(done).toHaveLength(1);
    expect(behind).toHaveLength(0);
  });

  it('keeps the API order of priority and deadline', () => {
    const low = make(1, { status: 'done', plannedWeekStart: WEEK, priority: 'P3' });
    const high = make(2, { status: 'done', plannedWeekStart: WEEK, priority: 'P1' });

    expect(summarize([low, high], WEEK).done.map(({ id }) => id)).toEqual([high.id, low.id]);
  });
});

describe('what was left behind', () => {
  it('remembers tasks planned for the week, keeping the ones remembered before', () => {
    const first = make(1, { plannedWeekStart: WEEK });
    const second = make(2, { plannedWeekStart: WEEK, status: 'in_progress' });

    const left = rememberLeft(new Set(), [first], WEEK);
    expect([...left]).toEqual([first.id]);

    const moved = { ...first, plannedWeekStart: NEXT };
    expect([...rememberLeft(left, [moved, second], WEEK)]).toEqual([first.id, second.id]);
  });

  it('returns the same set when nothing new was left behind', () => {
    const left = new Set(['x']);

    expect(rememberLeft(left, [make(1), make(2, { plannedWeekStart: NEXT })], WEEK)).toBe(left);
  });

  it('lists the remembered tasks that are not done, even after they were planned', () => {
    const planned = make(1, { plannedWeekStart: NEXT, priority: 'P3' });
    const urgent = make(2, { priority: 'P1' });
    const finished = make(3, { status: 'done' });
    const other = make(4);

    const tray = leftBehind(
      [planned, urgent, finished, other],
      new Set([planned.id, urgent.id, finished.id]),
    );

    expect(tray.map(({ id }) => id)).toEqual([urgent.id, planned.id]);
  });
});

describe('buildPlan', () => {
  it('groups open tasks by initiative in the given order and skips what is empty', () => {
    const inA = make(1, { initiativeId: A });
    const inB = make(2, { initiativeId: B, status: 'in_progress' });
    const done = make(3, { initiativeId: A, status: 'done' });

    const { groups } = buildPlan([inA, inB, done], [], [B, A, 'empty']);

    expect(
      groups.map(({ initiativeId, tasks }) => [initiativeId, tasks.map(({ id }) => id)]),
    ).toEqual([
      [B, [inB.id]],
      [A, [inA.id]],
    ]);
  });

  it('does not repeat a task left behind inside its group', () => {
    const left = make(1, { initiativeId: A, plannedWeekStart: WEEK });
    const other = make(2, { initiativeId: A });

    const plan = buildPlan([left, other], [left], [A]);

    expect(plan.behind).toEqual([left]);
    expect(plan.groups[0]?.tasks).toEqual([other]);
  });

  it('leaves out a task of an initiative that is not listed', () => {
    expect(buildPlan([make(1, { initiativeId: B })], [], [A]).groups).toEqual([]);
  });
});

describe('planning marks', () => {
  it('reads a mark from plannedWeekStart', () => {
    expect(isPlanned(make(1, { plannedWeekStart: NEXT }), NEXT)).toBe(true);
    expect(isPlanned(make(2, { plannedWeekStart: WEEK }), NEXT)).toBe(false);
    expect(isPlanned(make(3), NEXT)).toBe(false);
  });

  it('checking sets the next week and unchecking gives back the restore week', () => {
    expect(planChange(make(1), NEXT, null)).toEqual({ plannedWeekStart: NEXT });
    expect(planChange(make(2, { plannedWeekStart: WEEK }), NEXT, WEEK)).toEqual({
      plannedWeekStart: NEXT,
    });
    expect(planChange(make(3, { plannedWeekStart: NEXT }), NEXT, null)).toEqual({
      plannedWeekStart: null,
    });
    expect(planChange(make(4, { plannedWeekStart: NEXT }), NEXT, WEEK)).toEqual({
      plannedWeekStart: WEEK,
    });
  });
});

describe('deadlineText', () => {
  it('states the date plainly, never as late', () => {
    const now = new Date(2026, 10, 20, 10);

    expect(deadlineText('2026-11-14', now)).toBe('prazo sáb, 14 nov');
    expect(deadlineText('2026-11-25', now)).toBe('prazo qua, 25 nov');
    expect(deadlineText(null, now)).toBe('sem prazo');
  });
});

describe('counters', () => {
  const marked = make(1, { plannedWeekStart: NEXT });
  const unmarked = make(2);

  it('words a group as how many to do, then how many are marked', () => {
    expect(groupCounter([marked, unmarked, make(3)], NEXT)).toBe('1 de 3 marcadas');
    expect(groupCounter([unmarked, make(3), make(4)], NEXT)).toBe('3 a fazer');
    expect(groupCounter([unmarked], NEXT)).toBe('1 a fazer');
  });

  it('words the left-behind tray as how many enter', () => {
    expect(trayCounter([marked, unmarked], NEXT)).toBe('1 de 2 entram');
    expect(trayCounter([unmarked], NEXT)).toBe('0 de 1 entram');
  });
});

describe('tallyText', () => {
  it('says nothing is marked yet', () => {
    expect(tallyText([])).toEqual({ main: 'Nada marcado ainda', extra: null });
  });

  it('sums the effort and counts tasks without an estimate apart', () => {
    const tasks = [make(1, { estimatedEffort: 3 }), make(2, { estimatedEffort: 5 }), make(3)];

    expect(tallyText(tasks)).toEqual({ main: '3 tarefas · 8h', extra: '· 1 sem estimativa' });
  });

  it('uses the singular and a decimal comma without float noise', () => {
    expect(tallyText([make(1, { estimatedEffort: 1.5 })])).toEqual({
      main: '1 tarefa · 1,5h',
      extra: null,
    });
    expect(
      tallyText([make(1, { estimatedEffort: 0.1 }), make(2, { estimatedEffort: 0.2 })]).main,
    ).toBe('2 tarefas · 0,3h');
  });

  it('shows zero hours when no marked task has an estimate', () => {
    expect(tallyText([make(1), make(2)])).toEqual({
      main: '2 tarefas · 0h',
      extra: '· 2 sem estimativa',
    });
  });
});
