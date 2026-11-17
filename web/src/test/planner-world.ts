import { screen, within } from '@testing-library/react';
import { calendarEvent, scheduledItem, task } from './fixtures';
import { horta, reforma } from './task-world';

// Tuesday, 17 Nov 2026, 11:45: the week of 16 to 22 November.
export const NOW = new Date(2026, 10, 17, 11, 45);
export const WEEK = '2026-11-16';

export const paint = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000001',
  title: 'Comprar tinta',
  priority: 'P1',
  deadline: '2026-11-19',
  estimatedEffort: 4,
});
export const sand = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000002',
  title: 'Lixar parede',
  priority: 'P3',
  status: 'in_progress',
});
export const smash = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000004',
  title: 'Quebrar piso',
  priority: 'P2',
  deadline: '2026-11-24',
  estimatedEffort: 2,
});
export const lettuce = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000003',
  initiativeId: horta.id,
  title: 'Plantar alface',
  priority: 'P2',
  estimatedEffort: 1.5,
  deadline: '2026-11-18',
});
export const finished = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000005',
  title: 'Pedir orçamento',
  status: 'done',
  deadline: '2026-11-18',
});

export const plannerWorld = {
  initiatives: [reforma, horta],
  tasks: [paint, sand, smash, lettuce, finished],
};

export function block(overrides: Parameters<typeof scheduledItem>[0] = {}) {
  return scheduledItem({
    id: 'e0000000-0000-4000-8000-0000000000b1',
    taskId: paint.id,
    date: '2026-11-17',
    startTime: '09:00',
    endTime: '11:00',
    ...overrides,
  });
}

export function entry(overrides: Parameters<typeof scheduledItem>[0] = {}) {
  return scheduledItem({
    id: 'e0000000-0000-4000-8000-0000000000c1',
    taskId: sand.id,
    date: '2026-11-18',
    startTime: null,
    endTime: null,
    sortOrder: 1,
    ...overrides,
  });
}

export const daily = calendarEvent({ id: 'f0000000-0000-4000-8000-0000000000d1' });

export function tray() {
  return screen.getByRole('complementary', { name: 'Para planejar' });
}

export function trayItem(title: string) {
  return within(tray()).getByRole('article', { name: title });
}

export function trayTitles() {
  return within(tray())
    .queryAllByRole('article')
    .map((article) => article.getAttribute('aria-label'));
}

export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected the element to exist.');
  return value;
}

export function strip(date: string) {
  return must(document.querySelector<HTMLElement>(`[data-strip="${date}"]`));
}

export function agenda(date: string) {
  return must(document.querySelector<HTMLElement>(`[data-day="${date}"]`));
}
