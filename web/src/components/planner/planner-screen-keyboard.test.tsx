import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import {
  NOW,
  agenda,
  block,
  entry,
  paint,
  smash,
  plannerWorld,
  sand,
  strip,
  trayItem,
} from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
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

const ALT = (key: string) => `{Alt>}{${key}}{/Alt}`;
const ALT_SHIFT = (key: string) => `{Alt>}{Shift>}{${key}}{/Shift}{/Alt}`;

const dedicated = (name = /^Comprar tinta, /) => screen.getByRole('button', { name });
const announced = () => screen.getByRole('status', { name: 'Movimentos da agenda' });

function focus(element: HTMLElement) {
  act(() => {
    element.focus();
  });
}

const other = block({
  id: 'e0000000-0000-4000-8000-0000000000b2',
  taskId: sand.id,
  startTime: '11:00',
  endTime: '12:00',
});

describe('a block as the trigger of its popover', () => {
  it('announces the dialog, and opens with Enter and Space', async () => {
    const { user } = await renderWeek({ items: [block()] });
    focus(dedicated());
    expect(dedicated()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(dedicated()).toHaveAttribute('aria-expanded', 'false');
    expect(dedicated()).toHaveAccessibleDescription('Prioridade P1');

    await user.keyboard(' ');

    expect(await screen.findByRole('dialog', { name: 'Comprar tinta' })).toBeVisible();
    expect(dedicated()).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog', { name: 'Comprar tinta' })).toBeVisible();
  });
});

describe('moving a block with the keyboard', () => {
  it('moves it a quarter hour down with Alt+Down, announces it, and undoes', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    focus(dedicated());

    await user.keyboard(ALT('ArrowDown'));

    const moved = await screen.findByRole('button', { name: 'Comprar tinta, 9:15 – 11:15' });
    expect(backend.bodies).toEqual([{ startTime: '09:15', endTime: '11:15' }]);
    expect(announced()).toHaveTextContent('Bloco movido para ter, 9:15–11:15.');
    expect(moved).toHaveFocus();
    expect(await screen.findByText('Tempo movido')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }),
    ).toBeVisible();
    expect(backend.bodies.at(-1)).toEqual({
      date: '2026-11-17',
      startTime: '09:00',
      endTime: '11:00',
    });
  });

  it('moves it a quarter hour up with Alt+Up', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    focus(dedicated());

    await user.keyboard(ALT('ArrowUp'));

    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 8:45 – 10:45' }),
    ).toHaveFocus();
    expect(backend.bodies).toEqual([{ startTime: '08:45', endTime: '10:45' }]);
    expect(announced()).toHaveTextContent('Bloco movido para ter, 8:45–10:45.');
  });

  it('moves it a day to the right and to the left, keeping focus on it', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    focus(dedicated());

    await user.keyboard(ALT('ArrowRight'));

    await waitFor(() => {
      expect(dedicated()).toHaveFocus();
    });
    expect(backend.bodies).toEqual([{ date: '2026-11-18', startTime: '09:00', endTime: '11:00' }]);
    expect(announced()).toHaveTextContent('Bloco movido para qua, 9:00–11:00.');
    expect(
      within(agenda('2026-11-18')).getByRole('button', {
        name: /^Comprar tinta, /,
      }),
    ).toBeVisible();

    await user.keyboard(ALT('ArrowLeft'));

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { date: '2026-11-18', startTime: '09:00', endTime: '11:00' },
        { date: '2026-11-17', startTime: '09:00', endTime: '11:00' },
      ]);
    });
    expect(announced()).toHaveTextContent('Bloco movido para ter, 9:00–11:00.');
  });

  it('does nothing past the first or the last day of the week', async () => {
    const { backend, user } = await renderWeek({
      items: [block({ date: '2026-11-16' }), block({ id: other.id, date: '2026-11-22' })],
    });
    focus(within(agenda('2026-11-16')).getByRole('button', { name: /^Comprar tinta, / }));
    await user.keyboard(ALT('ArrowLeft'));
    expect(announced()).toHaveTextContent('Início da semana.');
    focus(within(agenda('2026-11-22')).getByRole('button', { name: /^Comprar tinta, / }));
    await user.keyboard(ALT('ArrowRight'));

    expect(backend.bodies).toEqual([]);
    expect(announced()).toHaveTextContent('Fim da semana.');
  });

  it('refuses a move into taken time, says so, and sends nothing', async () => {
    const { backend, user } = await renderWeek({ items: [block(), other] });
    focus(dedicated());

    await user.keyboard(ALT('ArrowDown'));

    expect(announced()).toHaveTextContent('Não cabe: já há tempo reservado.');
    expect(backend.bodies).toEqual([]);
    expect(dedicated()).toHaveFocus();
  });

  it('refuses a move to another day into taken time', async () => {
    const { backend, user } = await renderWeek({
      items: [block(), block({ id: other.id, taskId: sand.id, date: '2026-11-18' })],
    });
    focus(dedicated());

    await user.keyboard(ALT('ArrowRight'));

    expect(announced()).toHaveTextContent('Não cabe: já há tempo reservado.');
    expect(backend.bodies).toEqual([]);
  });

  it('ignores the arrows without Alt, and the horizontal ones with Shift', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    focus(dedicated());

    await user.keyboard('{ArrowDown}');
    await user.keyboard(ALT_SHIFT('ArrowRight'));
    await user.keyboard(ALT('Enter'));

    expect(backend.bodies).toEqual([]);
    expect(announced().textContent).toBe('');
  });

  it('queues presses made while the first request is in flight, each on what the last left', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    backend.latencyMs = 150;
    focus(dedicated());

    await user.keyboard(ALT('ArrowDown'));
    await user.keyboard(ALT('ArrowDown'));
    await user.keyboard(ALT('ArrowRight'));

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { startTime: '09:15', endTime: '11:15' },
        { startTime: '09:30', endTime: '11:30' },
        { date: '2026-11-18', startTime: '09:30', endTime: '11:30' },
      ]);
    });
    expect(announced()).toHaveTextContent('Bloco movido para qua, 9:30–11:30.');
  });

  it('does not move a block that still has a temporary id', async () => {
    const { backend, user } = await renderWeek();
    backend.latencyMs = 300;
    await user.click(
      within(trayItem('Comprar tinta')).getByRole('button', {
        name: 'Ações da tarefa Comprar tinta',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Reservar tempo…' }));
    await user.click(screen.getByRole('button', { name: 'Reservar' }));
    const created = await screen.findByRole('button', { name: /^Comprar tinta, / });
    focus(created);

    await user.keyboard(ALT('ArrowDown'));
    await user.keyboard(ALT_SHIFT('ArrowDown'));

    await waitFor(() => {
      expect(backend.bodies).toHaveLength(1);
    });
    expect(announced()).toHaveTextContent('Tempo reservado em');
  });
});

describe('the edges of the day', () => {
  it('says so at the start and the end of the day instead of staying silent', async () => {
    const { backend, user } = await renderWeek({
      items: [
        block({ startTime: '00:00', endTime: '01:00' }),
        block({ id: other.id, taskId: sand.id, startTime: '22:45', endTime: '23:45' }),
      ],
    });
    focus(screen.getByRole('button', { name: /^Comprar tinta, / }));
    await user.keyboard(ALT('ArrowUp'));
    expect(announced()).toHaveTextContent('Início do dia.');

    focus(screen.getByRole('button', { name: /^Lixar parede, / }));
    await user.keyboard(ALT('ArrowDown'));
    expect(announced()).toHaveTextContent('Fim do dia.');
    await user.keyboard(ALT_SHIFT('ArrowDown'));
    expect(announced()).toHaveTextContent('Fim do dia: não dá para estender.');
    expect(backend.bodies).toEqual([]);
  });
});

describe('focus after a keyboard move', () => {
  it('is not stolen later by a block moved within its day', async () => {
    const second = entry({ id: 'e0000000-0000-4000-8000-0000000000c2', taskId: smash.id });
    const { user } = await renderWeek({ items: [block(), entry(), second] });
    focus(dedicated());
    await user.keyboard(ALT('ArrowDown'));
    await screen.findByRole('button', { name: 'Comprar tinta, 9:15 – 11:15' });

    await user.click(
      within(strip('2026-11-18')).getByRole('button', {
        name: 'Tirar Lixar parede da lista do dia',
      }),
    );

    await waitFor(() => {
      expect(
        within(strip('2026-11-18')).getByRole('article', { name: 'Quebrar piso' }),
      ).toHaveFocus();
    });
  });
});

describe('resizing a block with the keyboard', () => {
  it('grows and shrinks it by a quarter hour with Alt+Shift+Down and Up', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    focus(dedicated());

    await user.keyboard(ALT_SHIFT('ArrowDown'));
    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 11:15' }),
    ).toBeVisible();
    expect(announced()).toHaveTextContent('Duração ajustada: ter, 9:00–11:15.');

    await user.keyboard(ALT_SHIFT('ArrowUp'));
    await waitFor(() => {
      expect(backend.bodies).toEqual([{ endTime: '11:15' }, { endTime: '11:00' }]);
    });
    expect(dedicated()).toHaveFocus();
  });

  it('keeps at least a quarter hour', async () => {
    const { backend, user } = await renderWeek({
      items: [block({ startTime: '09:00', endTime: '09:15' })],
    });
    focus(dedicated());

    await user.keyboard(ALT_SHIFT('ArrowUp'));

    expect(announced()).toHaveTextContent('Duração mínima: 15 minutos.');
    expect(backend.bodies).toEqual([]);
  });

  it('stops at the next block and says there is no room', async () => {
    const { backend, user } = await renderWeek({ items: [block(), other] });
    focus(dedicated());

    await user.keyboard(ALT_SHIFT('ArrowDown'));

    expect(announced()).toHaveTextContent('Não cabe: já há tempo reservado.');
    expect(backend.bodies).toEqual([]);
  });

  it('queues a second resize on what the first one left', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    backend.latencyMs = 150;
    focus(dedicated());

    await user.keyboard(ALT_SHIFT('ArrowDown'));
    await user.keyboard(ALT_SHIFT('ArrowDown'));

    await waitFor(() => {
      expect(backend.bodies).toEqual([{ endTime: '11:15' }, { endTime: '11:30' }]);
    });
  });
});

describe('moving a ficha with the keyboard', () => {
  const ficha = () => within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' });
  const onWednesday = () => within(strip('2026-11-18'));

  it('moves it to the next day with Alt+Right and back with Alt+Left', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });
    focus(onWednesday().getByRole('article', { name: 'Lixar parede' }));

    await user.keyboard(ALT('ArrowRight'));

    await waitFor(() => {
      expect(
        within(strip('2026-11-19')).getByRole('article', { name: 'Lixar parede' }),
      ).toHaveFocus();
    });
    expect(backend.bodies).toEqual([{ date: '2026-11-19' }]);
    expect(announced()).toHaveTextContent('Tarefa movida para qui, 19 nov.');
    expect(await screen.findByText('Tarefa movida para qui, 19 nov')).toBeVisible();

    await user.keyboard(ALT('ArrowLeft'));
    await waitFor(() => {
      expect(onWednesday().getByRole('article', { name: 'Lixar parede' })).toHaveFocus();
    });
    expect(announced()).toHaveTextContent('Tarefa movida para qua, 18 nov.');
  });

  it('refuses a day that already lists the task, with no request', async () => {
    const { backend, user } = await renderWeek({
      items: [entry(), entry({ id: 'e0000000-0000-4000-8000-0000000000c2', date: '2026-11-19' })],
    });
    focus(ficha());

    await user.keyboard(ALT('ArrowRight'));

    expect(announced()).toHaveTextContent('Essa tarefa já está na lista desse dia.');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Essa tarefa já está na lista desse dia.',
    );
    expect(backend.bodies).toEqual([]);
  });

  it('does nothing past the end of the week, or for other keys', async () => {
    const { backend, user } = await renderWeek({ items: [entry({ date: '2026-11-22' })] });
    focus(within(strip('2026-11-22')).getByRole('article', { name: 'Lixar parede' }));

    await user.keyboard(ALT('ArrowRight'));
    await user.keyboard(ALT('ArrowDown'));
    await user.keyboard('x');

    expect(backend.bodies).toEqual([]);
    expect(announced()).toHaveTextContent('Fim da semana.');
  });

  it('still opens the task with Enter', async () => {
    const { user } = await renderWeek({ items: [entry()] });
    focus(ficha());

    await user.keyboard('{Enter}');

    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
  });
});

describe('reserving time from a menu', () => {
  async function openReserve(user: ReturnType<typeof userEvent.setup>, title = 'Comprar tinta') {
    await user.click(
      within(trayItem(title)).getByRole('button', { name: `Ações da tarefa ${title}` }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Reservar tempo…' }));
    return screen.findByRole('dialog', { name: 'Reservar tempo' });
  }

  it('offers the days of the week and quarter hours, starting on today at 9:00', async () => {
    const { user } = await renderWeek();

    const dialog = await openReserve(user);

    const day = within(dialog).getByLabelText('Dia');
    expect(day).toHaveFocus();
    expect(day).toHaveValue('2026-11-17');
    expect(within(day).getAllByRole('option')).toHaveLength(7);
    const start = within(dialog).getByLabelText('Início');
    expect(start).toHaveDisplayValue('9:00');
    // The 4 hours left to reserve must fit before 23:45.
    expect(within(start).getAllByRole('option')).toHaveLength(80);
    expect(within(start).queryByRole('option', { name: '20:00' })).not.toBeInTheDocument();
    expect(within(start).getByRole('option', { name: '19:45' })).toBeInTheDocument();
  });

  it('reserves what is left on the chosen day and time, announces it, and undoes', async () => {
    const { backend, user } = await renderWeek();
    const dialog = await openReserve(user);

    await user.selectOptions(within(dialog).getByLabelText('Dia'), '2026-11-18');
    await user.selectOptions(within(dialog).getByLabelText('Início'), '14:00');
    await user.click(within(dialog).getByRole('button', { name: 'Reservar' }));

    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 14:00 – 18:00' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([
      { taskId: paint.id, date: '2026-11-18', startTime: '14:00', endTime: '18:00' },
    ]);
    expect(announced()).toHaveTextContent('Tempo reservado em qua, 14:00–18:00.');
    expect(screen.queryByRole('dialog', { name: 'Reservar tempo' })).not.toBeInTheDocument();
    expect(trayItem('Comprar tinta')).toHaveFocus();

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Comprar tinta, / })).not.toBeInTheDocument();
    });
  });

  it('keeps the popover open and says so when the time is taken', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    const dialog = await openReserve(user, 'Lixar parede');

    await user.selectOptions(within(dialog).getByLabelText('Início'), '10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Reservar' }));

    expect(within(dialog).getByText('Não cabe: já há tempo reservado.')).toBeVisible();
    expect(announced()).toHaveTextContent('Não cabe: já há tempo reservado.');
    expect(backend.bodies).toEqual([]);

    await user.selectOptions(within(dialog).getByLabelText('Início'), '11:00');
    expect(within(dialog).queryByText('Não cabe: já há tempo reservado.')).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Dia'), '2026-11-18');
    await user.click(within(dialog).getByRole('button', { name: 'Reservar' }));
    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { taskId: sand.id, date: '2026-11-18', startTime: '11:00', endTime: '12:00' },
      ]);
    });
  });

  it('turns a ficha into a block from its menu, and puts focus on the block', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });
    await user.click(
      within(strip('2026-11-18')).getByRole('button', { name: 'Ações da tarefa Lixar parede' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Reservar tempo…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reservar tempo' });
    expect(within(dialog).getByLabelText('Dia')).toHaveValue('2026-11-18');

    await user.click(within(dialog).getByRole('button', { name: 'Reservar' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lixar parede, 9:00 – 10:00' })).toHaveFocus();
    });
    expect(backend.bodies).toEqual([{ startTime: '09:00', endTime: '10:00' }]);
    expect(announced()).toHaveTextContent('Tempo reservado em qua, 9:00–10:00.');
  });

  it('closes with Escape, Cancel, a press outside, or Tab, returning focus to the item', async () => {
    const { backend, user } = await renderWeek();

    await openReserve(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Reservar tempo' })).not.toBeInTheDocument();
    expect(trayItem('Comprar tinta')).toHaveFocus();

    const dialog = await openReserve(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: 'Reservar tempo' })).not.toBeInTheDocument();

    await openReserve(user);
    await user.click(document.body);
    expect(screen.queryByRole('dialog', { name: 'Reservar tempo' })).not.toBeInTheDocument();

    expect(backend.bodies).toEqual([]);
  });

  it('keeps Tab inside the popover, wrapping from the last control to the first', async () => {
    const { user } = await renderWeek();
    const dialog = await openReserve(user);

    await user.tab();
    await user.tab();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByLabelText('Dia')).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(dialog.tagName).toBe('DIV');
  });

  it('disables the ficha item while the ficha has a temporary id', async () => {
    const { backend, user } = await renderWeek();
    backend.latencyMs = 300;
    await user.click(
      within(trayItem('Lixar parede')).getByRole('button', {
        name: 'Ações da tarefa Lixar parede',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Pôr na lista de hoje' }));
    const ficha = await within(strip('2026-11-17')).findByRole('article', { name: 'Lixar parede' });
    focus(ficha);

    await user.keyboard(ALT('ArrowRight'));
    await user.click(within(ficha).getByRole('button', { name: 'Ações da tarefa Lixar parede' }));

    expect(screen.getByRole('menuitem', { name: 'Reservar tempo…' })).toBeDisabled();
    expect(backend.bodies).toHaveLength(1);
  });
});
