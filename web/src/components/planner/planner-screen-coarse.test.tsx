import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import { NOW, entry, plannerWorld, strip } from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { setViewport } from '@/test/viewport';
import { PlannerScreen } from './planner-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const DAYS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
const POINTER = { button: 0, isPrimary: true, pointerId: 1 };

// jsdom has no layout: days sit side by side, 100px wide.
function layOut() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const list = this.getAttribute('data-strip');
    if (list) return new DOMRect(DAYS.indexOf(list) * 100, 100, 100, 80);
    return new DOMRect(0, 0, 100, 20);
  });
}

beforeEach(() => {
  layOut();
  navigateTo('/semana');
});

afterEach(() => {
  vi.restoreAllMocks();
  navigateTo('/');
});

async function dragFichaToThursday(pointer: { coarse: boolean }) {
  setViewport({ width: 900, ...pointer });
  const taskBackend = serveTaskApi(plannerWorld);
  const backend = servePlannerApi({ items: [entry()] }, taskBackend);
  renderWithQuery(<PlannerScreen now={NOW} />);
  await screen.findByRole('heading', { level: 1 });
  const ficha = within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' });
  const target = { x: 350, y: 120 };
  act(() => {
    fireEvent.pointerDown(ficha, { ...POINTER, clientX: 250, clientY: 120 });
  });
  for (const offset of [3, 2, 1, 0]) {
    act(() => {
      fireEvent.pointerMove(document, {
        ...POINTER,
        clientX: target.x,
        clientY: target.y - offset,
      });
    });
  }
  // A drag that started dims the ficha it carries; this is what tells the two pointers apart.
  const dragStarted = ficha.className.includes('source');
  act(() => {
    fireEvent.pointerUp(document, { ...POINTER, clientX: target.x, clientY: target.y });
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { backend, dragStarted };
}

describe('dragging in the week', () => {
  it('moves a ficha to another day with a fine pointer', async () => {
    const { backend, dragStarted } = await dragFichaToThursday({ coarse: false });

    expect(dragStarted).toBe(true);
    await waitFor(() => {
      expect(backend.bodies).not.toHaveLength(0);
    });
  });

  it('does nothing with a coarse pointer: moving goes through the menus', async () => {
    const { backend, dragStarted } = await dragFichaToThursday({ coarse: true });

    expect(dragStarted).toBe(false);
    expect(backend.bodies).toEqual([]);
    expect(within(strip('2026-11-19')).queryByRole('article')).not.toBeInTheDocument();
  });
});
