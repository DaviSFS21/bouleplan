import type { CalendarEvent, ScheduledItem, Task } from '@/api/types';
import type { IdentifiedSpan, Span } from './planner-geometry';
import { riskLabel } from './planner-tasks';
import { parseTime } from './planner-time';

export interface BlockModel {
  item: ScheduledItem;
  task: Task;
  color: string;
  span: Span;
}

export interface EntryModel {
  item: ScheduledItem;
  task: Task;
  color: string;
}

export interface DeadlineModel {
  task: Task;
  text: string;
}

export interface DayModel {
  date: string;
  events: CalendarEvent[];
  blocks: BlockModel[];
  entries: EntryModel[];
  deadlines: DeadlineModel[];
}

interface ModelInput {
  dates: readonly string[];
  events: readonly CalendarEvent[];
  items: readonly ScheduledItem[];
  tasks: ReadonlyMap<string, Task>;
  colors: ReadonlyMap<string, string>;
  atRisk: ReadonlySet<string>;
}

export function itemSpan(item: ScheduledItem): Span {
  return { start: parseTime(item.startTime ?? '0:00'), end: parseTime(item.endTime ?? '0:00') };
}

export function deadlineText(task: Task, atRisk: boolean): string {
  return atRisk ? `prazo · ${task.title} · ${riskLabel(task)}` : `prazo · ${task.title}`;
}

// Items of tasks that are not on screen (hidden ones) are left out.
export function buildDays({ dates, events, items, tasks, colors, atRisk }: ModelInput): DayModel[] {
  return dates.map((date) => {
    const mine = items.filter((item) => item.date === date);
    const colorOf = (task: Task) => colors.get(task.initiativeId) ?? '';
    const blocks = mine
      .filter((item) => item.startTime !== null)
      .flatMap((item) => {
        const task = tasks.get(item.taskId);
        return task ? [{ item, task, color: colorOf(task), span: itemSpan(item) }] : [];
      })
      .sort((a, b) => a.span.start - b.span.start);
    const entries = mine
      .filter((item) => item.startTime === null)
      .flatMap((item) => {
        const task = tasks.get(item.taskId);
        return task ? [{ item, task, color: colorOf(task) }] : [];
      })
      .sort(
        (a, b) =>
          (a.item.sortOrder ?? 0) - (b.item.sortOrder ?? 0) || a.item.id.localeCompare(b.item.id),
      );
    const deadlines = [...tasks.values()]
      .filter((task) => task.deadline === date && task.status !== 'done')
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((task) => ({ task, text: deadlineText(task, atRisk.has(task.id)) }));
    return {
      date,
      events: events
        .filter((event) => event.date === date)
        .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime)),
      blocks,
      entries,
      deadlines,
    };
  });
}

export function blockSpans(day: DayModel): IdentifiedSpan[] {
  return day.blocks.map(({ item, span }) => ({ id: item.id, ...span }));
}

export function weekSpans(days: readonly DayModel[]): Span[] {
  return days.flatMap((day) => [
    ...day.blocks.map(({ span }) => span),
    ...day.events.map((event) => ({
      start: parseTime(event.startTime),
      end: parseTime(event.endTime),
    })),
  ]);
}
