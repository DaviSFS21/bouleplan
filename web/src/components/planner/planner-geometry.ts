import {
  FOCUS_END_HOUR,
  FOCUS_START_HOUR,
  HOUR_HEIGHT,
  MAX_END,
  QUARTER,
  snapMinutes,
} from './planner-time';

const BLOCK_GAP = 4;
const MIN_BLOCK_HEIGHT = 8;

export interface Span {
  start: number;
  end: number;
}

export interface IdentifiedSpan extends Span {
  id: string;
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

export function findOverlap(
  candidate: Span,
  blocks: readonly IdentifiedSpan[],
  ignoreId?: string,
): IdentifiedSpan | undefined {
  return blocks.find((block) => block.id !== ignoreId && overlaps(candidate, block));
}

export function fitSpan(start: number, duration: number): Span {
  const fitted = Math.max(0, Math.min(start, MAX_END - duration));
  return { start: fitted, end: fitted + duration };
}

function pixelsToMinutes(pixels: number): number {
  return (pixels / HOUR_HEIGHT) * 60;
}

export function timeFromPointer(pointerY: number, columnTop: number, startHour: number): number {
  return Math.max(0, snapMinutes(startHour * 60 + pixelsToMinutes(pointerY - columnTop)));
}

// The quarter hour under the pointer, for drawing a span over the hours.
export function quarterAt(pointerY: number, columnTop: number, startHour: number): number {
  const minutes = startHour * 60 + pixelsToMinutes(pointerY - columnTop);
  return Math.min(MAX_END - QUARTER, Math.max(0, Math.floor(minutes / QUARTER) * QUARTER));
}

export function drawnSpan(anchor: number, current: number): Span {
  return { start: Math.min(anchor, current), end: Math.max(anchor, current) + QUARTER };
}

export function dropStartFromPointer(
  pointerY: number,
  columnTop: number,
  startHour: number,
  duration: number,
): Span {
  return fitSpan(timeFromPointer(pointerY, columnTop, startHour), duration);
}

export function moveStart(start: number, deltaY: number): number {
  return snapMinutes(start + pixelsToMinutes(deltaY));
}

// The bottom edge follows the pointer travel but stops at the next block of the day.
export function resizeEnd(span: Span, deltaY: number, others: readonly IdentifiedSpan[]): number {
  const limit = Math.min(
    MAX_END,
    ...others.filter((other) => other.start >= span.end).map((other) => other.start),
  );
  const wanted = snapMinutes(span.end + pixelsToMinutes(deltaY));
  return Math.min(Math.max(wanted, span.start + QUARTER), Math.max(limit, span.start + QUARTER));
}

export function blockStyle(span: Span, startHour: number): { top: number; height: number } {
  const top = pixelsFromMinutes(span.start - startHour * 60);
  const height = pixelsFromMinutes(span.end - span.start) - BLOCK_GAP;
  return { top, height: Math.max(height, MIN_BLOCK_HEIGHT) };
}

export function pixelsFromMinutes(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT;
}

export interface Lane {
  column: number;
  columns: number;
}

// Blocks that overlap share the width of the day, like a calendar.
export function layoutLanes(spans: readonly IdentifiedSpan[]): Map<string, Lane> {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const lanes = new Map<string, Lane>();
  let group: { id: string; column: number }[] = [];
  let groupEnd = 0;
  const close = () => {
    const columns = Math.max(1, ...group.map(({ column }) => column + 1));
    for (const { id, column } of group) lanes.set(id, { column, columns });
    group = [];
  };
  const ends: number[] = [];
  for (const span of sorted) {
    if (group.length > 0 && span.start >= groupEnd) {
      close();
      ends.length = 0;
    }
    let column = ends.findIndex((end) => end <= span.start);
    if (column < 0) column = ends.length;
    ends[column] = span.end;
    group.push({ id: span.id, column });
    groupEnd = Math.max(groupEnd, span.end);
  }
  close();
  return lanes;
}

// Scroll offset: the first focal hour, or the now line when it lies outside the focal range.
export function focusOffset(nowMinutes: number | null, viewport: number): number {
  const outside =
    nowMinutes !== null &&
    (nowMinutes < FOCUS_START_HOUR * 60 || nowMinutes >= FOCUS_END_HOUR * 60);
  if (!outside) return pixelsFromMinutes(FOCUS_START_HOUR * 60);
  return Math.max(0, pixelsFromMinutes(nowMinutes) - viewport / 2);
}
