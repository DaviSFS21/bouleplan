import type { ScheduledItem, Task } from '@/api/types';
import {
  dropStartFromPointer,
  findOverlap,
  fitSpan,
  moveStart,
  resizeEnd,
  type IdentifiedSpan,
  type Span,
} from './planner-geometry';
import { remainingMinutes } from './planner-tasks';
import { durationFor, parseTime } from './planner-time';

export type DragData =
  | { kind: 'tray'; task: Task }
  | { kind: 'ficha'; item: ScheduledItem; task: Task }
  | { kind: 'block'; item: ScheduledItem; task: Task }
  | { kind: 'resize'; item: ScheduledItem; task: Task };

export type DropTarget =
  | { kind: 'strip'; date: string }
  // top is the page position of the first visible hour of the day.
  | { kind: 'day'; date: string; top: number };

export type DropIntent =
  | { type: 'none' }
  | { type: 'blocked' }
  | { type: 'duplicate'; task: Task; date: string }
  | { type: 'add-to-list'; task: Task; date: string }
  | { type: 'move-entry'; item: ScheduledItem; date: string }
  | { type: 'reserve'; task: Task; date: string; span: Span }
  | { type: 'entry-to-block'; item: ScheduledItem; date: string; span: Span }
  | { type: 'move-block'; item: ScheduledItem; date: string; span: Span }
  | { type: 'resize'; item: ScheduledItem; end: number };

export interface Preview {
  date: string;
  span: Span;
  blocked: boolean;
  title: string;
  // The block being moved or resized.
  sourceId: string | null;
  resizing: boolean;
}

export interface DropContext {
  startHour: number;
  blocksOf: (date: string) => readonly IdentifiedSpan[];
  entriesOf: (date: string) => readonly ScheduledItem[];
}

export interface Resolution {
  intent: DropIntent;
  preview: Preview | null;
}

const NONE: Resolution = { intent: { type: 'none' }, preview: null };

function onStrip(data: DragData, date: string, context: DropContext): DropIntent {
  if (data.kind === 'block' || data.kind === 'resize') return { type: 'none' };
  if (data.kind === 'ficha' && data.item.date === date) return { type: 'none' };
  const listed = context.entriesOf(date).some((entry) => entry.taskId === data.task.id);
  if (listed) return { type: 'duplicate', task: data.task, date };
  return data.kind === 'tray'
    ? { type: 'add-to-list', task: data.task, date }
    : { type: 'move-entry', item: data.item, date };
}

function spanOf(item: ScheduledItem): Span {
  return { start: parseTime(item.startTime ?? '0:00'), end: parseTime(item.endTime ?? '0:00') };
}

function onResize(
  data: Extract<DragData, { kind: 'resize' }>,
  deltaY: number,
  context: DropContext,
): Resolution {
  const span = spanOf(data.item);
  const end = resizeEnd(span, deltaY, context.blocksOf(data.item.date));
  const preview: Preview = {
    date: data.item.date,
    span: { start: span.start, end },
    blocked: false,
    title: data.task.title,
    sourceId: data.item.id,
    resizing: true,
  };
  return {
    intent: end === span.end ? { type: 'none' } : { type: 'resize', item: data.item, end },
    preview,
  };
}

function onDay(
  data: Exclude<DragData, { kind: 'resize' }>,
  target: Extract<DropTarget, { kind: 'day' }>,
  pointerY: number,
  deltaY: number,
  context: DropContext,
): Resolution {
  const moving = data.kind === 'block';
  const duration = moving
    ? spanOf(data.item).end - spanOf(data.item).start
    : durationFor(remainingMinutes(data.task));
  const span = moving
    ? fitSpan(moveStart(spanOf(data.item).start, deltaY), duration)
    : dropStartFromPointer(pointerY, target.top, context.startHour, duration);
  const blocked =
    findOverlap(span, context.blocksOf(target.date), moving ? data.item.id : undefined) !==
    undefined;
  const preview: Preview = {
    date: target.date,
    span,
    blocked,
    title: data.task.title,
    sourceId: moving ? data.item.id : null,
    resizing: false,
  };
  if (blocked) return { intent: { type: 'blocked' }, preview };
  if (data.kind === 'tray') {
    return { intent: { type: 'reserve', task: data.task, date: target.date, span }, preview };
  }
  if (data.kind === 'ficha') {
    return {
      intent: { type: 'entry-to-block', item: data.item, date: target.date, span },
      preview,
    };
  }
  const origin = spanOf(data.item);
  const unchanged =
    target.date === data.item.date && span.start === origin.start && span.end === origin.end;
  return {
    intent: unchanged
      ? { type: 'none' }
      : { type: 'move-block', item: data.item, date: target.date, span },
    preview,
  };
}

// The same answer drives the preview while dragging and the request on drop.
export function resolveDrop(
  data: DragData,
  target: DropTarget | null,
  pointerY: number,
  deltaY: number,
  context: DropContext,
): Resolution {
  if (data.kind === 'resize') return onResize(data, deltaY, context);
  if (target === null) return NONE;
  if (target.kind === 'strip')
    return { intent: onStrip(data, target.date, context), preview: null };
  return onDay(data, target, pointerY, deltaY, context);
}
