import { screen } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { problemResponse, scheduledItem, task } from '@/test/fixtures';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { ReservedTime, reservedSummary } from './reserved-time';

describe('reservedSummary', () => {
  it.each([
    [0, 6, 'nada reservado ainda'],
    [0, null, 'nada reservado ainda'],
    [240, 6, '4h de 6h reservadas'],
    [120, null, '2h reservadas'],
    [90, 1.5, '1,5h de 1,5h reservadas'],
  ])('words %d minutes against %s hours', (minutes, estimate, text) => {
    expect(reservedSummary(minutes, estimate)).toBe(text);
  });
});

describe('ReservedTime', () => {
  it('lists the blocks of the task with their day, range and length', async () => {
    server.use(
      http.get('*/api/tasks/:id/scheduled-items', () =>
        Response.json([
          scheduledItem({ date: '2026-11-04', startTime: '09:00', endTime: '11:00' }),
          scheduledItem({ id: 'x', date: '2026-11-06', startTime: '14:00', endTime: '16:30' }),
        ]),
      ),
    );

    renderWithQuery(<ReservedTime task={task({ estimatedEffort: 6 })} />);

    expect(await screen.findByText('qua, 4 nov')).toBeVisible();
    expect(screen.getByText('9:00 – 11:00 · 2h')).toBeVisible();
    expect(screen.getByText('14:00 – 16:30 · 2,5h')).toBeVisible();
    expect(screen.getByText('4,5h de 6h reservadas')).toBeVisible();
  });

  it('says nothing is reserved when the task has no block', async () => {
    renderWithQuery(<ReservedTime task={task()} />);

    expect(await screen.findByText('nada reservado ainda')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('says so when the blocks cannot be loaded', async () => {
    server.use(http.get('*/api/tasks/:id/scheduled-items', () => problemResponse('internal', 500)));

    renderWithQuery(<ReservedTime task={task()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o tempo dedicado.',
    );
  });

  it('shows nothing while loading', async () => {
    server.use(
      http.get('*/api/tasks/:id/scheduled-items', async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return Response.json([]);
      }),
    );

    renderWithQuery(<ReservedTime task={task()} />);

    expect(screen.queryByText('nada reservado ainda')).not.toBeInTheDocument();
    expect(await screen.findByText('nada reservado ainda')).toBeVisible();
  });
});
