import { describe, expect, it } from 'vitest';
import { calendarEvent, scheduledItem, task } from '@/test/fixtures';
import { blockSpans, buildDays, deadlineText, itemSpan, weekSpans } from './planner-model';

const MON = '2026-11-16';
const TUE = '2026-11-17';
const paint = task({ id: 'p', initiativeId: 'ini-1', title: 'Pintar', deadline: TUE });
const sand = task({ id: 's', initiativeId: 'ini-2', title: 'Lixar' });
const tasks = new Map([paint, sand].map((item) => [item.id, item]));
const colors = new Map([
  ['ini-1', 'turquesa'],
  ['ini-2', 'roxo'],
]);

function build(overrides: Partial<Parameters<typeof buildDays>[0]> = {}) {
  return buildDays({
    dates: [MON, TUE],
    events: [],
    items: [],
    tasks,
    colors,
    atRisk: new Set(),
    ...overrides,
  });
}

describe('buildDays', () => {
  it('gives each day its blocks in time order, with the initiative color', () => {
    const late = scheduledItem({
      id: 'b2',
      taskId: 's',
      date: TUE,
      startTime: '14:00',
      endTime: '15:00',
    });
    const early = scheduledItem({
      id: 'b1',
      taskId: 'p',
      date: TUE,
      startTime: '09:00',
      endTime: '10:30',
    });

    const [monday, tuesday] = build({ items: [late, early] });

    expect(monday?.blocks).toEqual([]);
    expect(tuesday?.blocks.map(({ item }) => item.id)).toEqual(['b1', 'b2']);
    expect(tuesday?.blocks[0]).toMatchObject({
      color: 'turquesa',
      span: { start: 540, end: 630 },
    });
  });

  it('gives each day its list in the order of the list, ties by id', () => {
    const entry = (id: string, taskId: string, sortOrder: number | null) =>
      scheduledItem({ id, taskId, date: MON, startTime: null, endTime: null, sortOrder });

    const [monday] = build({
      items: [entry('c', 'p', 2), entry('b', 's', 1), entry('a', 's', 2), entry('z', 'p', null)],
    });

    expect(monday?.entries.map(({ item }) => item.id)).toEqual(['z', 'b', 'a', 'c']);
  });

  it('breaks a tie in the list order by creation, then id', () => {
    const entry = (id: string, createdAt: string) =>
      scheduledItem({
        id,
        taskId: 'p',
        date: MON,
        startTime: null,
        endTime: null,
        sortOrder: 1,
        createdAt,
      });

    const [monday] = build({
      items: [
        entry('a', '2026-11-16T12:00:00-03:00'),
        entry('c', '2026-11-16T10:00:00-03:00'),
        entry('b', '2026-11-16T10:00:00-03:00'),
      ],
    });

    expect(monday?.entries.map(({ item }) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('leaves out the items of tasks that are not on screen', () => {
    const hidden = scheduledItem({ taskId: 'gone', date: MON });
    const hiddenEntry = scheduledItem({
      id: 'x',
      taskId: 'gone',
      date: MON,
      startTime: null,
      endTime: null,
      sortOrder: 1,
    });

    const [monday] = build({ items: [hidden, hiddenEntry] });

    expect(monday?.blocks).toEqual([]);
    expect(monday?.entries).toEqual([]);
  });

  it('puts the events of the day in time order', () => {
    const second = calendarEvent({ id: '2', date: MON, startTime: '14:00', endTime: '15:00' });
    const first = calendarEvent({ id: '1', date: MON, startTime: '09:00', endTime: '09:30' });
    const other = calendarEvent({ id: '3', date: TUE });

    const [monday, tuesday] = build({ events: [second, first, other] });

    expect(monday?.events.map(({ id }) => id)).toEqual(['1', '2']);
    expect(tuesday?.events.map(({ id }) => id)).toEqual(['3']);
  });

  it('lists the deadlines of the day for tasks that are not done', () => {
    const done = task({ id: 'd', title: 'Feita', status: 'done', deadline: TUE });
    const both = new Map([...tasks, ['d', done]]);

    const [monday, tuesday] = build({ tasks: both, atRisk: new Set(['p']) });

    expect(monday?.deadlines).toEqual([]);
    expect(tuesday?.deadlines).toEqual([
      { task: paint, text: 'prazo · Pintar · sem tempo reservado' },
    ]);
  });
});

describe('deadlineText', () => {
  it('adds what is missing only for a task at risk', () => {
    const sized = task({ title: 'Pintar', estimatedEffort: 4, reservedByDeadlineMinutes: 120 });
    expect(deadlineText(sized, false)).toBe('prazo · Pintar');
    expect(deadlineText(sized, true)).toBe('prazo · Pintar · faltam 2h');
  });
});

describe('spans', () => {
  it('reads an item span', () => {
    expect(itemSpan(scheduledItem({ startTime: '09:15', endTime: '10:00' }))).toEqual({
      start: 555,
      end: 600,
    });
  });

  it('lists the blocks of a day with their ids', () => {
    const block = scheduledItem({ id: 'b1', taskId: 'p', date: MON });
    const [monday] = build({ items: [block] });

    expect(monday && blockSpans(monday)).toEqual([{ id: 'b1', start: 540, end: 600 }]);
  });

  it('lists every block and event of the week', () => {
    const block = scheduledItem({ taskId: 'p', date: MON, startTime: '07:00', endTime: '08:00' });
    const event = calendarEvent({ date: TUE, startTime: '19:00', endTime: '20:00' });

    expect(weekSpans(build({ items: [block], events: [event] }))).toEqual([
      { start: 420, end: 480 },
      { start: 1140, end: 1200 },
    ]);
  });
});
