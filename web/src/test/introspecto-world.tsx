import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { IntrospectoScreen } from '@/components/introspecto/introspecto-screen';
import { serveIntrospectionApi } from './introspection-backend';
import { renderWithQuery } from './render';
import { serveTaskApi } from './task-backend';
import { initiative, task } from './fixtures';
import { horta, reforma } from './task-world';

// Friday, 20 Nov 2026: the review is about the current week, 16 to 22 November.
export const FRIDAY = new Date(2026, 10, 20, 10, 0);
// Tuesday, 17 Nov 2026: the review is about the week that just ended, 9 to 15 November.
export const TUESDAY = new Date(2026, 10, 17, 11, 45);
export const WEEK = '2026-11-16';
export const NEXT = '2026-11-23';
export const PREVIOUS = '2026-11-09';

const id = (n: number) => `a1a1a1a1-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const paintedRoom = task({
  id: id(1),
  title: 'Pintar sala',
  status: 'done',
  plannedWeekStart: WEEK,
  updatedAt: '2026-11-19T10:00:00-03:00',
});
export const boughtPaint = task({
  id: id(2),
  initiativeId: horta.id,
  title: 'Comprar sementes',
  status: 'done',
  updatedAt: '2026-11-18T09:00:00-03:00',
});
export const oldChore = task({
  id: id(3),
  title: 'Tarefa antiga',
  status: 'done',
  updatedAt: '2026-11-02T09:00:00-03:00',
});
export const sanding = task({
  id: id(4),
  title: 'Lixar parede',
  priority: 'P1',
  deadline: '2026-11-14',
  estimatedEffort: 4,
  plannedWeekStart: WEEK,
});
export const breaking = task({
  id: id(5),
  title: 'Quebrar piso',
  status: 'in_progress',
  priority: 'P2',
  plannedWeekStart: WEEK,
});
export const tap = task({
  id: id(6),
  title: 'Instalar torneira',
  priority: 'P3',
  estimatedEffort: 2,
});
export const planting = task({
  id: id(7),
  initiativeId: horta.id,
  title: 'Plantar alface',
  estimatedEffort: 1.5,
});
export const watering = task({
  id: id(8),
  initiativeId: horta.id,
  title: 'Regar canteiro',
  status: 'in_progress',
  priority: 'P3',
});
export const reviewPlan = task({
  id: id(9),
  title: 'Revisar o projeto',
  priority: 'P2',
  estimatedEffort: 3,
  plannedWeekStart: NEXT,
});

export const introspectoWorld = {
  initiatives: [reforma, horta],
  tasks: [
    paintedRoom,
    boughtPaint,
    oldChore,
    sanding,
    breaking,
    tap,
    planting,
    watering,
    reviewPlan,
  ],
};

export const cozinha = initiative({
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Cozinha',
  color: 'azul',
});

export function section(name: string) {
  return screen.getByRole('region', { name });
}

export function summaryList(name: string) {
  return within(section('A semana que passou')).getByRole('list', { name });
}

export function box(name: string) {
  return screen.getByRole('checkbox', { name });
}

export async function renderSheet(
  options: {
    now?: Date;
    sheets?: Parameters<typeof serveIntrospectionApi>[0];
    world?: Partial<Parameters<typeof serveTaskApi>[0]>;
    // true lets time run on its own; 'manual' moves only when the test moves it.
    fake?: boolean | 'manual';
  } = {},
) {
  if (options.fake) vi.useFakeTimers({ shouldAdvanceTime: options.fake !== 'manual' });
  const tasks = serveTaskApi({ ...introspectoWorld, ...options.world });
  const backend = serveIntrospectionApi(options.sheets);
  renderWithQuery(<IntrospectoScreen now={options.now ?? FRIDAY} />);
  await screen.findByRole('heading', { level: 1 });
  return { backend, tasks, user: userEvent.setup({ delay: null }) };
}
