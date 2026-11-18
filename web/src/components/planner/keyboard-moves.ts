'use client';

import { createContext, useContext, useRef, useState } from 'react';
import { DUPLICATE_ITEM_MESSAGE } from '@/api/messages';
import type { ScheduledItem, Task } from '@/api/types';
import { deadlineWeekday, dayRow } from './planner-dates';
import { resolveDrop, type DragData, type DropContext, type DropIntent } from './planner-drop';
import { pixelsFromMinutes, type Span } from './planner-geometry';
import { itemSpan } from './planner-model';
import { MAX_END, QUARTER, formatApiTime, formatRange } from './planner-time';

export const NO_ROOM_MESSAGE = 'Não cabe: já há tempo reservado.';
export const MINIMUM_DURATION_MESSAGE = 'Duração mínima: 15 minutos.';
export const DAY_START_MESSAGE = 'Início do dia.';
export const DAY_END_MESSAGE = 'Fim do dia: não dá para estender.';
export const DAY_END_MOVE_MESSAGE = 'Fim do dia.';
export const WEEK_START_MESSAGE = 'Início da semana.';
export const WEEK_END_MESSAGE = 'Fim da semana.';

export interface PlannedItem {
  item: ScheduledItem;
  task: Task;
}

export type ReserveOrigin =
  { kind: 'tray'; task: Task } | { kind: 'ficha'; item: ScheduledItem; task: Task };

export interface KeyboardMoves {
  moveBlock: (planned: PlannedItem, steps: { days: number; quarters: number }) => void;
  resizeBlock: (planned: PlannedItem, quarters: number) => void;
  moveFicha: (planned: PlannedItem, days: number) => void;
  startReserve: (origin: ReserveOrigin) => void;
}

const ARROWS: Readonly<Record<string, { days: number; quarters: number }>> = {
  ArrowUp: { days: 0, quarters: -1 },
  ArrowDown: { days: 0, quarters: 1 },
  ArrowLeft: { days: -1, quarters: 0 },
  ArrowRight: { days: 1, quarters: 0 },
};

// What one arrow key means: a day to either side, or a quarter hour up or down.
export function arrowStep(key: string): { days: number; quarters: number } | null {
  return Object.hasOwn(ARROWS, key) ? (ARROWS[key] ?? null) : null;
}

export const KeyboardMovesContext = createContext<KeyboardMoves | null>(null);

export function useKeyboardMoves(): KeyboardMoves | null {
  return useContext(KeyboardMovesContext);
}

interface Options {
  dates: readonly string[];
  startHour: number;
  context: () => DropContext;
  // Sends the request of a drop intent, the same one a drag sends.
  apply: (intent: DropIntent) => Promise<void>;
  // Keeps focus on the thing that moved when it is drawn again somewhere else.
  keepFocus: (selector: string | null) => void;
}

interface Landing {
  count: number;
  date: string;
  span: Span | null;
}

export interface PlannerKeyboard {
  moves: Omit<KeyboardMoves, 'startReserve'>;
  reserve: (origin: ReserveOrigin, date: string, start: number) => boolean;
  announcement: { id: number; text: string };
}

function resizeRefusal(quarters: number, end: number): string {
  if (quarters < 0) return MINIMUM_DURATION_MESSAGE;
  return end >= MAX_END ? DAY_END_MESSAGE : NO_ROOM_MESSAGE;
}

function when(date: string, span: Span): string {
  return `${deadlineWeekday(date)}, ${formatRange(span.start, span.end)}`;
}

export function usePlannerKeyboard({
  dates,
  startHour,
  context,
  apply,
  keepFocus,
}: Readonly<Options>): PlannerKeyboard {
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const landings = useRef(new Map<string, Landing>());

  function announce(text: string) {
    setAnnouncement((current) => ({ id: current.id + 1, text }));
  }

  // Keys pressed before the first request is answered build on where it is taking the item.
  function latest(item: ScheduledItem): ScheduledItem {
    const landing = landings.current.get(item.id);
    if (!landing) return item;
    return {
      ...item,
      date: landing.date,
      startTime: landing.span ? formatApiTime(landing.span.start) : item.startTime,
      endTime: landing.span ? formatApiTime(landing.span.end) : item.endTime,
    };
  }

  function send(item: ScheduledItem, date: string, span: Span | null, intent: DropIntent) {
    const landing = landings.current.get(item.id) ?? { count: 0, date, span };
    landing.count += 1;
    landing.date = date;
    landing.span = span;
    landings.current.set(item.id, landing);
    void apply(intent).finally(() => {
      landing.count -= 1;
      if (landing.count === 0 && landings.current.get(item.id) === landing) {
        landings.current.delete(item.id);
        // The item is where it will stay: nothing is left to find.
        keepFocus(null);
      }
    });
  }

  function neighbour(date: string, days: number): string | null {
    return dates[dates.indexOf(date) + days] ?? null;
  }

  function moveBlock({ item, task }: PlannedItem, steps: { days: number; quarters: number }) {
    const current = latest(item);
    const date = neighbour(current.date, steps.days);
    if (date === null) {
      announce(steps.days < 0 ? WEEK_START_MESSAGE : WEEK_END_MESSAGE);
      return;
    }
    const deltaY = pixelsFromMinutes(steps.quarters * QUARTER);
    const { intent } = resolveDrop(
      { kind: 'block', item: current, task },
      { kind: 'day', date, top: 0 },
      0,
      deltaY,
      context(),
    );
    if (intent.type === 'blocked') announce(NO_ROOM_MESSAGE);
    if (intent.type === 'none')
      announce(steps.quarters < 0 ? DAY_START_MESSAGE : DAY_END_MOVE_MESSAGE);
    if (intent.type !== 'move-block') return;
    announce(`Bloco movido para ${when(intent.date, intent.span)}.`);
    if (intent.date !== current.date) keepFocus(`[data-block-id="${item.id}"]`);
    send(item, intent.date, intent.span, intent);
  }

  function resizeBlock({ item, task }: PlannedItem, quarters: number) {
    const current = latest(item);
    const { intent } = resolveDrop(
      { kind: 'resize', item: current, task },
      null,
      0,
      pixelsFromMinutes(quarters * QUARTER),
      context(),
    );
    if (intent.type !== 'resize') {
      announce(resizeRefusal(quarters, itemSpan(current).end));
      return;
    }
    const span = { start: itemSpan(current).start, end: intent.end };
    announce(`Duração ajustada: ${when(current.date, span)}.`);
    send(item, current.date, span, intent);
  }

  function moveFicha({ item, task }: PlannedItem, days: number) {
    const current = latest(item);
    const date = neighbour(current.date, days);
    if (date === null) {
      announce(days < 0 ? WEEK_START_MESSAGE : WEEK_END_MESSAGE);
      return;
    }
    const data: DragData = { kind: 'ficha', item: current, task };
    const { intent } = resolveDrop(data, { kind: 'strip', date }, 0, 0, context());
    if (intent.type === 'duplicate') {
      announce(DUPLICATE_ITEM_MESSAGE);
      void apply(intent);
      return;
    }
    if (intent.type !== 'move-entry') return;
    announce(`Tarefa movida para ${dayRow(date)}.`);
    keepFocus(`[data-ficha-id="${item.id}"]`);
    send(item, date, null, intent);
  }

  // The same rules as a drop at that time of that day.
  function reserve(origin: ReserveOrigin, date: string, start: number): boolean {
    const data: DragData =
      origin.kind === 'tray'
        ? { kind: 'tray', task: origin.task }
        : { kind: 'ficha', item: latest(origin.item), task: origin.task };
    const { intent } = resolveDrop(
      data,
      { kind: 'day', date, top: 0 },
      pixelsFromMinutes(start - startHour * 60),
      0,
      context(),
    );
    if (intent.type === 'blocked') {
      announce(NO_ROOM_MESSAGE);
      return false;
    }
    if (intent.type !== 'reserve' && intent.type !== 'entry-to-block') return true;
    announce(`Tempo reservado em ${when(date, intent.span)}.`);
    if (intent.type === 'entry-to-block') {
      keepFocus(`[data-day="${date}"] [data-block-task-id="${origin.task.id}"]`);
    }
    void apply(intent).finally(() => {
      keepFocus(null);
    });
    return true;
  }

  return {
    moves: { moveBlock, resizeBlock, moveFicha },
    reserve,
    announcement,
  };
}
