import { screen, within } from '@testing-library/react';
import { initiative, phase, task } from './fixtures';

export const reforma = initiative();
export const horta = initiative({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Horta',
  color: 'verde',
  createdAt: '2026-01-02T10:00:00-03:00',
});

export const demolicao = phase({ name: 'Demolição' });
export const piso = phase({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Piso',
  createdAt: '2026-01-02T10:00:00-03:00',
});

export const paint = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000001',
  title: 'Comprar tinta',
  description: 'Duas latas de branco.',
  priority: 'P1',
  deadline: '2026-11-06',
  phaseId: piso.id,
});
export const sand = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000002',
  title: 'Lixar parede',
  priority: 'P3',
  status: 'in_progress',
});
export const lettuce = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000003',
  initiativeId: horta.id,
  title: 'Plantar alface',
  status: 'done',
  deadline: '2026-11-04',
});
export const smash = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000004',
  title: 'Quebrar piso',
  deadline: '2026-11-10',
  phaseId: demolicao.id,
});
export const quote = task({
  id: 'a1a1a1a1-0000-4000-8000-000000000005',
  title: 'Pedir orçamento',
  isBlocked: true,
});

export const world = {
  initiatives: [reforma, horta],
  phases: [demolicao, piso],
  tasks: [paint, sand, lettuce, smash, quote],
};

export function column(name: string) {
  return screen.getByRole('region', { name });
}

export function card(title: string) {
  return screen.getByRole('article', { name: title });
}

export function titles(name: string) {
  return within(column(name))
    .queryAllByRole('article')
    .map((article) => article.getAttribute('aria-label'));
}
