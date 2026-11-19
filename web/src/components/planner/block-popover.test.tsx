import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import { NOW, block, plannerWorld, sand } from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { PHONE, setViewport } from '@/test/viewport';
import { PlannerScreen } from './planner-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/semana');
});

afterEach(() => {
  navigateTo('/');
});

async function renderWeek(world: Parameters<typeof servePlannerApi>[0] = {}) {
  const taskBackend = serveTaskApi(plannerWorld);
  const backend = servePlannerApi(world, taskBackend);
  renderWithQuery(<PlannerScreen now={NOW} />);
  await screen.findByRole('heading', { level: 1 });
  return { backend, user: userEvent.setup() };
}

const other = block({
  id: 'e0000000-0000-4000-8000-0000000000b2',
  taskId: sand.id,
  startTime: '11:00',
  endTime: '12:00',
});

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }));
  return screen.findByRole('dialog', { name: 'Comprar tinta' });
}

describe('the block popover', () => {
  it('shows the task, the day, the times and the duration, with the day field focused', async () => {
    const { user } = await renderWeek({ items: [block()] });

    const dialog = await open(user);

    expect(within(dialog).getByText('P1')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Abrir tarefa Comprar tinta' }),
    ).toBeVisible();
    expect(within(dialog).getByLabelText('Dia')).toHaveValue('2026-11-17');
    expect(within(dialog).getByLabelText('Dia')).toHaveFocus();
    expect(within(dialog).getByLabelText('Início')).toHaveValue('540');
    expect(within(dialog).getByLabelText('Fim')).toHaveValue('660');
    expect(within(dialog).getByText('2h')).toBeVisible();
  });

  it('offers every day of the week and starts across the whole day', async () => {
    const { user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    expect(within(within(dialog).getByLabelText('Dia')).getAllByRole('option')).toHaveLength(7);
    const starts = within(within(dialog).getByLabelText('Início')).getAllByRole('option');
    expect(starts[0]).toHaveTextContent('0:00');
    expect(starts.at(-1)).toHaveTextContent('23:30');
  });

  it('offers only ends after the start, and keeps the duration when the start moves', async () => {
    const { user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    const ends = within(within(dialog).getByLabelText('Fim')).getAllByRole('option');
    expect(ends[0]).toHaveTextContent('9:15');
    expect(ends.at(-1)).toHaveTextContent('23:45');

    await user.selectOptions(within(dialog).getByLabelText('Início'), '14:00');
    expect(within(dialog).getByLabelText('Fim')).toHaveValue('960');
    expect(within(dialog).getByText('2h')).toBeVisible();

    await user.selectOptions(within(dialog).getByLabelText('Início'), '23:30');
    expect(within(dialog).getByLabelText('Fim')).toHaveValue('1425');
    expect(within(dialog).getByText('15min')).toBeVisible();

    await user.selectOptions(within(dialog).getByLabelText('Início'), '9:00');
    await user.selectOptions(within(dialog).getByLabelText('Fim'), '10:30');
    expect(within(dialog).getByText('1h30')).toBeVisible();
  });

  it('saves the day and the times in one request, announces it and undoes', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    await user.selectOptions(within(dialog).getByLabelText('Dia'), '2026-11-19');
    await user.selectOptions(within(dialog).getByLabelText('Início'), '13:00');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Tempo movido')).toBeVisible();
    expect(backend.bodies).toEqual([{ date: '2026-11-19', startTime: '13:00', endTime: '15:00' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Movimentos da agenda' })).toHaveTextContent(
      'Bloco movido para qui, 13:00–15:00.',
    );
    const moved = await screen.findByRole('button', { name: 'Comprar tinta, 13:00 – 15:00' });
    await waitFor(() => {
      expect(moved).toHaveFocus();
    });

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }),
    ).toBeVisible();
  });

  it('refuses a time taken by another block, sends nothing and stays open', async () => {
    const { backend, user } = await renderWeek({ items: [block(), other] });
    const dialog = await open(user);

    await user.selectOptions(within(dialog).getByLabelText('Fim'), '11:30');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não cabe: já há tempo reservado.',
    );
    expect(backend.calls).toEqual([]);
    expect(dialog).toBeVisible();

    await user.selectOptions(within(dialog).getByLabelText('Fim'), '11:00');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes without a request when nothing changed', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toEqual([]);
  });

  it('cancels, returning focus to the block', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    await user.selectOptions(within(dialog).getByLabelText('Início'), '14:00');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' })).toHaveFocus();
    expect(backend.calls).toEqual([]);
  });

  it('closes on a press outside, and keeps Tab inside', async () => {
    const { user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(
      within(dialog).getByRole('button', { name: 'Abrir tarefa Comprar tinta' }),
    ).toHaveFocus();

    await user.click(screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes the block off the agenda from the popover', async () => {
    const { user } = await renderWeek({ items: [block()] });
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Tirar da agenda' }));

    expect(await screen.findByText('Tempo tirado da agenda')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a sheet on a phone', async () => {
    setViewport(PHONE);
    const { user } = await renderWeek({ items: [block()] });

    await user.click(await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }));

    const dialog = await screen.findByRole('dialog', { name: 'Comprar tinta' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByLabelText('Dia')).toHaveFocus();
  });
});
