import { describe, expect, it } from 'vitest';
import { scheduledItem, task } from '@/test/fixtures';
import { resolveDrop, type DragData, type DropTarget } from './planner-drop';

const DAY = '2026-11-17';
const NEXT = '2026-11-18';
const paint = task({ estimatedEffort: 2, reservedMinutes: 0 });
const block = scheduledItem({ date: DAY, startTime: '09:00', endTime: '10:00' });
const entry = scheduledItem({
  id: 'e0000000-0000-4000-8000-000000000009',
  date: DAY,
  startTime: null,
  endTime: null,
  sortOrder: 1,
});

const context = {
  startHour: 8,
  blocksOf: (date: string) => (date === DAY ? [{ id: block.id, start: 540, end: 600 }] : []),
  entriesOf: (date: string) => (date === DAY ? [entry] : []),
};

const day = (date: string): DropTarget => ({ kind: 'day', date, top: 100 });
const strip = (date: string): DropTarget => ({ kind: 'strip', date });
const tray: DragData = { kind: 'tray', task: paint };
const ficha: DragData = { kind: 'ficha', item: entry, task: paint };
const moving: DragData = { kind: 'block', item: block, task: paint };

describe('dropping on a strip', () => {
  it('adds a tray task to that day list', () => {
    expect(resolveDrop(tray, strip(NEXT), 0, 0, context)).toEqual({
      intent: { type: 'add-to-list', task: paint, date: NEXT },
      preview: null,
    });
  });

  it('refuses a task that is already in that day list', () => {
    expect(resolveDrop(tray, strip(DAY), 0, 0, context).intent).toEqual({
      type: 'duplicate',
      task: paint,
      date: DAY,
    });
  });

  it('moves a ficha to another day', () => {
    expect(resolveDrop(ficha, strip(NEXT), 0, 0, context).intent).toEqual({
      type: 'move-entry',
      item: entry,
      date: NEXT,
    });
  });

  it('does nothing for a ficha dropped on its own day or a block on a strip', () => {
    expect(resolveDrop(ficha, strip(DAY), 0, 0, context).intent).toEqual({ type: 'none' });
    expect(resolveDrop(moving, strip(NEXT), 0, 0, context).intent).toEqual({ type: 'none' });
  });

  it('refuses a ficha that is already in the list of the other day', () => {
    const crowded = { ...context, entriesOf: () => [{ ...entry, taskId: paint.id }] };
    expect(resolveDrop(ficha, strip(NEXT), 0, 0, crowded).intent).toMatchObject({
      type: 'duplicate',
    });
  });
});

describe('dropping on the hours', () => {
  it('reserves a block at the pointer time with what is left to reserve', () => {
    const result = resolveDrop(tray, day(NEXT), 100 + 48 * 3, 0, context);

    expect(result.intent).toEqual({
      type: 'reserve',
      task: paint,
      date: NEXT,
      span: { start: 11 * 60, end: 13 * 60 },
    });
    expect(result.preview).toMatchObject({ date: NEXT, blocked: false, title: paint.title });
  });

  it('gives an hour to a task without an estimate or with nothing left', () => {
    const loose = task({ estimatedEffort: null });
    const full = task({ estimatedEffort: 1, reservedMinutes: 60 });
    expect(
      resolveDrop({ kind: 'tray', task: loose }, day(NEXT), 100, 0, context).intent,
    ).toMatchObject({
      span: { start: 480, end: 540 },
    });
    expect(
      resolveDrop({ kind: 'tray', task: full }, day(NEXT), 100, 0, context).intent,
    ).toMatchObject({
      span: { start: 480, end: 540 },
    });
  });

  it('turns a ficha into a block', () => {
    expect(resolveDrop(ficha, day(NEXT), 100 + 48, 0, context).intent).toEqual({
      type: 'entry-to-block',
      item: entry,
      date: NEXT,
      span: { start: 9 * 60, end: 11 * 60 },
    });
  });

  it('is blocked, and drops nothing, where there is a block already', () => {
    const result = resolveDrop(tray, day(DAY), 100 + 48, 0, context);

    expect(result.preview).toMatchObject({ blocked: true });
    expect(result.intent).toEqual({ type: 'blocked' });
  });

  it('allows a block to overlap itself while moving', () => {
    const result = resolveDrop(moving, day(DAY), 0, 12, context);

    expect(result.intent).toEqual({
      type: 'move-block',
      item: block,
      date: DAY,
      span: { start: 9 * 60 + 15, end: 10 * 60 + 15 },
    });
  });

  it('moves a block to another day by the pointer travel', () => {
    const result = resolveDrop(moving, day(NEXT), 0, 96, context);

    expect(result.intent).toMatchObject({
      type: 'move-block',
      date: NEXT,
      span: { start: 11 * 60, end: 12 * 60 },
    });
  });

  it('does nothing when a block ends up where it was', () => {
    expect(resolveDrop(moving, day(DAY), 0, 3, context).intent).toEqual({ type: 'none' });
  });

  it('is blocked when a moved block lands on another one', () => {
    const crowded = {
      ...context,
      blocksOf: () => [
        { id: block.id, start: 540, end: 600 },
        { id: 'other', start: 660, end: 720 },
      ],
    };
    expect(resolveDrop(moving, day(DAY), 0, 96, crowded).intent).toEqual({ type: 'blocked' });
  });
});

describe('resizing', () => {
  const resizing: DragData = { kind: 'resize', item: block, task: paint };

  it('moves the bottom edge in quarter hours', () => {
    const result = resolveDrop(resizing, null, 0, 24, context);

    expect(result.intent).toEqual({ type: 'resize', item: block, end: 630 });
    expect(result.preview).toMatchObject({
      date: DAY,
      span: { start: 540, end: 630 },
      resizing: true,
      sourceId: block.id,
    });
  });

  it('does nothing when the edge did not move', () => {
    expect(resolveDrop(resizing, null, 0, 2, context).intent).toEqual({ type: 'none' });
  });

  it('stops at the next block', () => {
    const crowded = {
      ...context,
      blocksOf: () => [
        { id: block.id, start: 540, end: 600 },
        { id: 'other', start: 660, end: 720 },
      ],
    };
    expect(resolveDrop(resizing, null, 0, 480, crowded).intent).toEqual({
      type: 'resize',
      item: block,
      end: 660,
    });
  });
});

describe('without a target', () => {
  it('does nothing and shows no preview', () => {
    expect(resolveDrop(tray, null, 0, 0, context)).toEqual({
      intent: { type: 'none' },
      preview: null,
    });
    expect(resolveDrop(moving, null, 0, 0, context)).toEqual({
      intent: { type: 'none' },
      preview: null,
    });
  });
});
