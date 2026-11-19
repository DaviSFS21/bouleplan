import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import {
  NOW,
  agenda,
  must,
  block,
  daily,
  entry,
  paint,
  plannerWorld,
  sand,
  smash,
  strip,
  trayItem,
} from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { PlannerScreen } from './planner-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const DAYS = [
  '2026-11-16',
  '2026-11-17',
  '2026-11-18',
  '2026-11-19',
  '2026-11-20',
  '2026-11-21',
  '2026-11-22',
];
const AGENDA_TOP = 200;
const STRIP_TOP = 100;

// jsdom has no layout: days sit side by side, 100px wide, the lists above the hours.
function layOut() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const day = this.getAttribute('data-day');
    if (day) return new DOMRect(DAYS.indexOf(day) * 100, AGENDA_TOP, 100, 24 * 48);
    const list = this.getAttribute('data-strip');
    if (list) return new DOMRect(DAYS.indexOf(list) * 100, STRIP_TOP, 100, 80);
    return new DOMRect(0, 0, 100, 20);
  });
}

// The pointer position over a day: x in its column, y at the given hour of the day.
const at = (date: string, hours: number) => ({
  x: DAYS.indexOf(date) * 100 + 50,
  y: AGENDA_TOP + hours * 48,
});
const onStrip = (date: string) => ({ x: DAYS.indexOf(date) * 100 + 50, y: STRIP_TOP + 20 });

beforeEach(() => {
  layOut();
  navigateTo('/semana');
});

afterEach(() => {
  vi.restoreAllMocks();
  navigateTo('/');
});

async function renderWeek(world: Parameters<typeof servePlannerApi>[0] = {}) {
  const taskBackend = serveTaskApi(plannerWorld);
  const backend = servePlannerApi(world, taskBackend);
  renderWithQuery(<PlannerScreen now={NOW} />);
  await screen.findByRole('heading', { level: 1 });
  return { backend, taskBackend, user: userEvent.setup() };
}

const CLICK_GUARD_MS = 80;
const POINTER = { button: 0, isPrimary: true, pointerId: 1 };

function press(source: Element, from = { x: 5, y: 5 }) {
  act(() => {
    fireEvent.pointerDown(source, { ...POINTER, clientX: from.x, clientY: from.y });
  });
}

// A real pointer reports several moves; the first starts the drag, the next ones update it.
function moveTo(to: { x: number; y: number }) {
  for (const offset of [3, 2, 1, 0]) {
    act(() => {
      fireEvent.pointerMove(document, { ...POINTER, clientX: to.x, clientY: to.y - offset });
    });
  }
}

async function release(to: { x: number; y: number }) {
  act(() => {
    fireEvent.pointerUp(document, { ...POINTER, clientX: to.x, clientY: to.y });
  });
  // dnd-kit swallows the click that follows a drag for a moment.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, CLICK_GUARD_MS));
  });
}

async function drag(source: Element, to: { x: number; y: number }, from = { x: 5, y: 5 }) {
  press(source, from);
  moveTo(to);
  await release(to);
}

describe('dragging from the tray', () => {
  it('reserves a block at the drop time with what is left to reserve', async () => {
    const { backend } = await renderWeek();

    await drag(trayItem('Comprar tinta'), at('2026-11-17', 11));

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { taskId: paint.id, date: '2026-11-17', startTime: '11:00', endTime: '15:00' },
      ]);
    });
    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 11:00 – 15:00' }),
    ).toBeVisible();
    expect(await screen.findByText('Tempo reservado')).toBeVisible();
  });

  it('gives an hour to a task without an estimate', async () => {
    const { backend } = await renderWeek();

    await drag(trayItem('Lixar parede'), at('2026-11-19', 9));

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { taskId: sand.id, date: '2026-11-19', startTime: '09:00', endTime: '10:00' },
      ]);
    });
  });

  it('shows a preview while dragging and removes it on cancel', async () => {
    const { backend } = await renderWeek();
    press(trayItem('Comprar tinta'));

    moveTo(at('2026-11-17', 10));
    await waitFor(() => {
      expect(document.querySelector('[data-preview="free"]')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });
    expect(document.querySelector('[data-preview]')).not.toBeInTheDocument();
    expect(backend.calls).toEqual([]);
  });

  it('adds the task to the list of the day dropped on, and undoes it', async () => {
    const { backend, user } = await renderWeek();

    await drag(trayItem('Lixar parede'), onStrip('2026-11-18'));

    expect(
      await within(strip('2026-11-18')).findByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ taskId: sand.id, date: '2026-11-18' }]);
    expect(await screen.findByText('Tarefa na lista de qua, 18 nov')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(within(strip('2026-11-18')).queryByRole('article')).not.toBeInTheDocument();
    });
    expect(backend.items).toEqual([]);
  });

  it('refuses a task that is already in that list, with no request', async () => {
    const { backend } = await renderWeek({ items: [entry()] });

    await drag(trayItem('Lixar parede'), onStrip('2026-11-18'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Essa tarefa já está na lista desse dia.',
    );
    expect(backend.calls).toEqual([]);
  });

  it('refuses a block that would overlap another, with the blocked preview and no request', async () => {
    const { backend } = await renderWeek({ items: [block({ taskId: smash.id })] });
    press(trayItem('Lixar parede'));

    moveTo(at('2026-11-17', 9.5));
    await waitFor(() => {
      expect(document.querySelector('[data-preview="blocked"]')).toBeInTheDocument();
    });
    const preview = must(document.querySelector<HTMLElement>('[data-preview="blocked"]'));
    expect(preview).toHaveTextContent('não cabe aqui · já há tempo reservado');
    expect(preview.className).toMatch(/blocked/);

    await release(at('2026-11-17', 9.5));
    expect(backend.calls).toEqual([]);
    expect(document.querySelector('[data-preview]')).not.toBeInTheDocument();
  });

  it('drops a task from the alert at once, before the server answers, when its estimate is reserved', async () => {
    const { backend } = await renderWeek();
    backend.latencyMs = 300;
    expect(screen.getByText(/2 tarefas vencem/)).toBeVisible();

    await drag(trayItem('Comprar tinta'), at('2026-11-17', 9));

    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 13:00' }),
    ).toBeVisible();
    expect(screen.getByText(/1 tarefa vence/)).toBeVisible();
    await waitFor(() => {
      expect(backend.items).toHaveLength(1);
    });
  });

  it('puts the task back and says why when the server refuses', async () => {
    const { backend } = await renderWeek();
    backend.failing.add('POST');

    await drag(trayItem('Comprar tinta'), at('2026-11-17', 11));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível reservar o tempo. Tente de novo.',
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Comprar tinta, / })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Prazos sem tempo reservado.')).toBeVisible();
  });
});

describe('dragging a ficha', () => {
  it('turns it into a block at the drop time and back on undo', async () => {
    const { backend, user } = await renderWeek({
      items: [entry({ date: '2026-11-17', taskId: smash.id, sortOrder: 4 })],
    });
    const ficha = within(strip('2026-11-17')).getByRole('article', { name: 'Quebrar piso' });

    await drag(ficha, at('2026-11-18', 10));

    expect(
      await screen.findByRole('button', { name: 'Quebrar piso, 10:00 – 12:00' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ date: '2026-11-18', startTime: '10:00', endTime: '12:00' }]);
    expect(within(strip('2026-11-17')).queryByRole('article')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(
        within(strip('2026-11-17')).getByRole('article', { name: 'Quebrar piso' }),
      ).toBeVisible();
    });
    expect(backend.bodies.at(-1)).toEqual({
      date: '2026-11-17',
      startTime: null,
      endTime: null,
      sortOrder: 4,
    });
  });

  it('moves it to another day and back on undo', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });
    const ficha = within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' });

    await drag(ficha, onStrip('2026-11-20'));

    expect(
      await within(strip('2026-11-20')).findByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ date: '2026-11-20' }]);

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(
        within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' }),
      ).toBeVisible();
    });
  });

  it('does nothing when dropped on its own day', async () => {
    const { backend } = await renderWeek({ items: [entry()] });
    const ficha = within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' });

    await drag(ficha, onStrip('2026-11-18'));

    expect(backend.calls).toEqual([]);
  });

  it('removes it with the cross, once even when clicked twice, and undoes', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });

    const remove = screen.getByRole('button', { name: 'Tirar Lixar parede da lista do dia' });
    await user.dblClick(remove);

    await waitFor(() => {
      expect(within(strip('2026-11-18')).queryByRole('article')).not.toBeInTheDocument();
    });
    expect(backend.calls.filter((call) => call.startsWith('DELETE'))).toHaveLength(1);

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));
    expect(
      await within(strip('2026-11-18')).findByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
    expect(backend.bodies.at(-1)).toEqual({ taskId: sand.id, date: '2026-11-18' });
  });

  it('puts the ficha back when removing fails', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });
    backend.failing.add('DELETE');

    await user.click(screen.getByRole('button', { name: 'Tirar Lixar parede da lista do dia' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível tirar da agenda. Tente de novo.',
    );
    expect(
      within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
  });
});

describe('dragging a block', () => {
  const dedicated = () => screen.getByRole('button', { name: /^Comprar tinta, / });

  it('moves it to another day and time, and back on undo', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });

    // 9h to 11h moves down 2 hours (96px) and one column right.
    await drag(dedicated(), at('2026-11-17', 11.5), at('2026-11-17', 9.5));

    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 11:00 – 13:00' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ startTime: '11:00', endTime: '13:00' }]);
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

  it('changes the day when dropped over another column', async () => {
    const { backend } = await renderWeek({ items: [block()] });
    press(dedicated(), { x: 150, y: 250 });

    moveTo({ x: 250, y: 250 });
    await release({ x: 250, y: 250 });

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { date: '2026-11-18', startTime: '09:00', endTime: '11:00' },
      ]);
    });
  });

  it('returns to its place, with no request, when dropped over another block', async () => {
    const { backend } = await renderWeek({
      items: [
        block(),
        block({
          id: 'e0000000-0000-4000-8000-0000000000b2',
          taskId: smash.id,
          startTime: '12:00',
          endTime: '13:00',
        }),
      ],
    });
    press(dedicated(), at('2026-11-17', 9.5));

    moveTo(at('2026-11-17', 12.5));
    await waitFor(() => {
      expect(document.querySelector('[data-preview="blocked"]')).toBeInTheDocument();
    });
    await release(at('2026-11-17', 12.5));

    expect(backend.calls).toEqual([]);
    expect(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' })).toBeVisible();
  });

  it('does nothing when dropped where it was', async () => {
    const { backend } = await renderWeek({ items: [block()] });

    await drag(dedicated(), at('2026-11-17', 9.6), at('2026-11-17', 9.5));

    expect(backend.calls).toEqual([]);
  });

  it('keeps the block where it was when the server refuses the move', async () => {
    const { backend } = await renderWeek({ items: [block()] });
    backend.failing.add('PATCH');

    await drag(dedicated(), at('2026-11-17', 11.5), at('2026-11-17', 9.5));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível mover. Tente de novo.',
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' })).toBeVisible();
    });
  });

  it('resizes by the bottom handle in quarter hours, and back on undo', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });
    const handle = must(document.querySelector<HTMLElement>('[data-resize-handle]'));

    press(handle);
    moveTo({ x: 5, y: 5 + 36 });
    expect(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:45' })).toBeVisible();
    await release({ x: 5, y: 5 + 36 });

    await waitFor(() => {
      expect(backend.bodies).toEqual([{ endTime: '11:45' }]);
    });
    expect(await screen.findByText('Duração ajustada')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }),
    ).toBeVisible();
    expect(backend.bodies.at(-1)).toEqual({ endTime: '11:00' });
  });

  it('stops the resize at the next block', async () => {
    const { backend } = await renderWeek({
      items: [
        block(),
        block({
          id: 'e0000000-0000-4000-8000-0000000000b2',
          taskId: smash.id,
          startTime: '12:00',
          endTime: '13:00',
        }),
      ],
    });
    const handle = must(
      document.querySelector<HTMLElement>(`[data-resize-handle="${block().id}"]`),
    );

    await drag(handle, { x: 5, y: 5 + 480 });

    await waitFor(() => {
      expect(backend.bodies).toEqual([{ endTime: '12:00' }]);
    });
  });
});

describe('fixed events', () => {
  async function draw(from: { x: number; y: number }, to: { x: number; y: number }) {
    press(agenda('2026-11-18'), from);
    moveTo(to);
    await release(to);
  }

  it('creates one by dragging over empty time, with the title field in focus', async () => {
    const { backend, user } = await renderWeek();

    await draw(at('2026-11-18', 14), at('2026-11-18', 15.4));

    const field = await screen.findByRole('textbox', { name: 'Título do compromisso' });
    expect(field).toHaveFocus();
    await user.type(field, 'Reunião{Enter}');

    expect(await screen.findByRole('button', { name: 'Reunião, 14:00 – 15:30' })).toBeVisible();
    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { title: 'Reunião', date: '2026-11-18', startTime: '14:00', endTime: '15:30' },
      ]);
    });
    expect(await screen.findByText('Compromisso criado')).toBeVisible();
  });

  it('cancels with Escape, or when left empty', async () => {
    const { backend, user } = await renderWeek();

    await draw(at('2026-11-18', 9), at('2026-11-18', 10));
    await screen.findByRole('textbox', { name: 'Título do compromisso' });
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('textbox', { name: 'Título do compromisso' }),
    ).not.toBeInTheDocument();

    await draw(at('2026-11-18', 9), at('2026-11-18', 10));
    await screen.findByRole('textbox', { name: 'Título do compromisso' });
    await user.click(document.body);
    expect(
      screen.queryByRole('textbox', { name: 'Título do compromisso' }),
    ).not.toBeInTheDocument();
    expect(backend.calls).toEqual([]);
  });

  it('does not create on Enter while the title is empty', async () => {
    const { backend, user } = await renderWeek();

    await draw(at('2026-11-18', 9), at('2026-11-18', 10));
    await screen.findByRole('textbox', { name: 'Título do compromisso' });
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox', { name: 'Título do compromisso' })).toBeVisible();
    expect(backend.calls).toEqual([]);
  });

  it('creates when the field loses focus with a title', async () => {
    const { backend, user } = await renderWeek();

    await draw(at('2026-11-18', 9), at('2026-11-18', 9));
    await user.type(
      await screen.findByRole('textbox', { name: 'Título do compromisso' }),
      'Dentista',
    );
    await user.click(document.body);

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { title: 'Dentista', date: '2026-11-18', startTime: '09:00', endTime: '09:15' },
      ]);
    });
  });

  it('draws upwards too', async () => {
    const { backend, user } = await renderWeek();

    await draw(at('2026-11-18', 11), at('2026-11-18', 10));
    await user.type(
      await screen.findByRole('textbox', { name: 'Título do compromisso' }),
      'Ajuste{Enter}',
    );

    await waitFor(() => {
      expect(backend.bodies).toEqual([
        { title: 'Ajuste', date: '2026-11-18', startTime: '10:00', endTime: '11:15' },
      ]);
    });
  });

  it('drops the event and says why when the server refuses', async () => {
    const { backend, user } = await renderWeek();
    backend.failing.add('EVENT-POST');

    await draw(at('2026-11-18', 9), at('2026-11-18', 10));
    await user.type(
      await screen.findByRole('textbox', { name: 'Título do compromisso' }),
      'Reunião{Enter}',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar o compromisso. Tente de novo.',
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Reunião/ })).not.toBeInTheDocument();
    });
  });

  it('does not start drawing from a press on a block', async () => {
    await renderWeek({ events: [daily] });

    press(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    await release({ x: 150, y: 400 });

    expect(
      screen.queryByRole('textbox', { name: 'Título do compromisso' }),
    ).not.toBeInTheDocument();
  });

  it('ignores a press with another button, and cancels a pointer that is cancelled', async () => {
    await renderWeek();

    act(() => {
      fireEvent.pointerDown(agenda('2026-11-18'), {
        ...POINTER,
        button: 2,
        clientX: 250,
        clientY: 300,
      });
    });
    await release(at('2026-11-18', 12));
    expect(
      screen.queryByRole('textbox', { name: 'Título do compromisso' }),
    ).not.toBeInTheDocument();

    press(agenda('2026-11-18'), at('2026-11-18', 12));
    act(() => {
      fireEvent.pointerCancel(document, { ...POINTER });
    });
    await release(at('2026-11-18', 12));
    expect(
      screen.queryByRole('textbox', { name: 'Título do compromisso' }),
    ).not.toBeInTheDocument();
  });

  it('opens a popover on click, renames inline, and deletes with undo', async () => {
    const { backend, user } = await renderWeek({ events: [daily] });

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));

    const dialog = await screen.findByRole('dialog', { name: 'Compromisso' });
    expect(within(dialog).getByText('9:00–9:30')).toBeVisible();
    const title = within(dialog).getByRole('textbox', { name: 'Título do compromisso' });
    await user.clear(title);
    await user.type(title, 'Daily do time{Enter}');
    await waitFor(() => {
      expect(backend.bodies).toEqual([{ title: 'Daily do time' }]);
    });
    expect(await screen.findByRole('button', { name: 'Daily do time, 9:00 – 9:30' })).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Daily/ })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByRole('button', { name: 'Daily do time, 9:00 – 9:30' })).toBeVisible();
    expect(backend.bodies.at(-1)).toEqual({
      title: 'Daily do time',
      date: '2026-11-17',
      startTime: '09:00',
      endTime: '09:30',
    });
  });

  it('closes the popover with Escape and returns focus to the event', async () => {
    const { user } = await renderWeek({ events: [daily] });
    const event = screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' });

    await user.click(event);
    await screen.findByRole('dialog', { name: 'Compromisso' });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(event).toHaveFocus();
  });

  it('closes the popover on a press outside', async () => {
    const { user } = await renderWeek({ events: [daily] });

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    await screen.findByRole('dialog', { name: 'Compromisso' });
    await user.click(screen.getByRole('heading', { level: 1 }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the title and says why when it is renamed to blank', async () => {
    const { user, backend } = await renderWeek({ events: [daily] });

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    const title = await screen.findByRole('textbox', { name: 'Título do compromisso' });
    await user.clear(title);
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Dê um título ao compromisso.')).toBeVisible();
    expect(backend.calls).toEqual([]);
  });

  it('puts the title back and says why when renaming fails', async () => {
    const { user, backend } = await renderWeek({ events: [daily] });
    backend.failing.add('EVENT-PATCH');

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    const title = await screen.findByRole('textbox', { name: 'Título do compromisso' });
    await user.clear(title);
    await user.type(title, 'Outro{Enter}');

    expect(
      await screen.findByText('Não foi possível salvar o compromisso. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' })).toBeVisible();
    });
  });

  it('brings the event back when deleting fails', async () => {
    const { user, backend } = await renderWeek({ events: [daily] });
    backend.failing.add('EVENT-DELETE');

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir' }));

    expect(
      await screen.findByText('Não foi possível excluir o compromisso. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' })).toBeVisible();
    });
  });
});

describe('menu alternatives', () => {
  it('puts a task in the list of today from the tray menu, hides the item afterwards, and undoes', async () => {
    const { backend, user } = await renderWeek();

    await user.click(
      within(trayItem('Lixar parede')).getByRole('button', {
        name: 'Ações da tarefa Lixar parede',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Pôr na lista de hoje' }));

    expect(
      await within(strip('2026-11-17')).findByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ taskId: sand.id, date: '2026-11-17' }]);
    expect(await screen.findByText('Tarefa na lista de hoje')).toBeVisible();

    await user.click(
      within(trayItem('Lixar parede')).getByRole('button', {
        name: 'Ações da tarefa Lixar parede',
      }),
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Pôr na lista de hoje' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(within(strip('2026-11-17')).queryByRole('article')).not.toBeInTheDocument();
    });
  });

  it('opens the task from the tray menu', async () => {
    const { user } = await renderWeek();

    await user.click(
      within(trayItem('Lixar parede')).getByRole('button', {
        name: 'Ações da tarefa Lixar parede',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Abrir' }));

    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
  });

  it('opens the task from the block popover', async () => {
    const { user } = await renderWeek({ items: [block()] });

    await user.click(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }));
    await user.click(screen.getByRole('button', { name: 'Abrir tarefa Comprar tinta' }));

    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
  });

  it('takes a block off the agenda with the popover and puts it back on undo', async () => {
    const { backend, user } = await renderWeek({ items: [block()] });

    await user.click(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }));
    await user.click(screen.getByRole('button', { name: 'Tirar da agenda' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Comprar tinta, / })).not.toBeInTheDocument();
    });
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(
      await screen.findByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }),
    ).toBeVisible();
    expect(backend.bodies.at(-1)).toEqual({
      taskId: paint.id,
      date: '2026-11-17',
      startTime: '09:00',
      endTime: '11:00',
    });
  });

  it('opens the block popover with Enter on the focused block, and with a click', async () => {
    const { user } = await renderWeek({ items: [block()] });
    const dedicated = screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' });

    dedicated.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Comprar tinta' })).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(dedicated).toHaveFocus();

    await user.click(dedicated);
    expect(await screen.findByRole('dialog', { name: 'Comprar tinta' })).toBeVisible();
  });

  it('keeps the undo shortcut working', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });

    await user.click(screen.getByRole('button', { name: 'Tirar Lixar parede da lista do dia' }));
    await screen.findByText('Tarefa tirada da lista do dia');
    await user.keyboard('{Control>}z{/Control}');

    await waitFor(() => {
      expect(backend.items).toHaveLength(1);
    });
  });

  it('says the undo failed when the server refuses it', async () => {
    const { backend, user } = await renderWeek({ items: [entry()] });

    await user.click(screen.getByRole('button', { name: 'Tirar Lixar parede da lista do dia' }));
    await screen.findByText('Tarefa tirada da lista do dia');
    backend.failing.add('POST');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText('Não foi possível desfazer. Tente de novo.')).toBeVisible();
  });
});

describe('overlapping blocks', () => {
  it('render side by side and neither hides the other', async () => {
    await renderWeek({
      items: [
        block(),
        block({
          id: 'e0000000-0000-4000-8000-0000000000b2',
          taskId: smash.id,
          startTime: '10:00',
          endTime: '12:00',
        }),
      ],
    });

    const first = screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' });
    const second = screen.getByRole('button', { name: 'Quebrar piso, 10:00 – 12:00' });

    expect(first).toBeVisible();
    expect(second).toBeVisible();
    expect(first.style.left).not.toBe(second.style.left);
    expect(first.style.left).toContain('/ 2');
    expect(second.style.right).toContain('* 0 / 2');
  });

  it('still refuses a drop into a slot taken by any of them', async () => {
    const { backend } = await renderWeek({
      items: [
        block(),
        block({
          id: 'e0000000-0000-4000-8000-0000000000b2',
          taskId: smash.id,
          startTime: '10:00',
          endTime: '12:00',
        }),
      ],
    });

    await drag(trayItem('Lixar parede'), at('2026-11-17', 11.5));

    expect(backend.calls).toEqual([]);
  });
});

describe('things that still have a temporary id', () => {
  it('cannot be removed before the server answers, and the popover stays open for the saved event', async () => {
    const { backend, user } = await renderWeek();
    backend.latencyMs = 400;

    await user.click(
      within(trayItem('Lixar parede')).getByRole('button', {
        name: 'Ações da tarefa Lixar parede',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Pôr na lista de hoje' }));
    const remove = await screen.findByRole('button', {
      name: 'Tirar Lixar parede da lista do dia',
    });
    expect(remove).toBeDisabled();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Tirar Lixar parede da lista do dia' }),
      ).toBeEnabled();
    });
    expect(backend.calls).toEqual(['POST item']);
  });

  it('keeps an event popover open, read-only, until its id arrives', async () => {
    const { backend, user } = await renderWeek();
    backend.latencyMs = 1500;

    press(agenda('2026-11-18'), at('2026-11-18', 9));
    moveTo(at('2026-11-18', 10));
    await release(at('2026-11-18', 10));
    await user.type(
      await screen.findByRole('textbox', { name: 'Título do compromisso' }),
      'Reunião{Enter}',
    );

    await user.click(await screen.findByRole('button', { name: /^Reunião, / }));
    const dialog = await screen.findByRole('dialog', { name: 'Compromisso' });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Excluir' })).toBeDisabled();

    await waitFor(() => {
      expect(
        within(screen.getByRole('dialog', { name: 'Compromisso' })).getByRole('textbox', {
          name: 'Título do compromisso',
        }),
      ).toBeVisible();
    });
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled();
  });

  it('cannot take a new block off the agenda before the server answers', async () => {
    const { backend, user } = await renderWeek();
    backend.latencyMs = 400;

    await drag(trayItem('Comprar tinta'), at('2026-11-17', 11));
    await user.click(await screen.findByRole('button', { name: /^Comprar tinta, / }));

    expect(screen.getByRole('button', { name: 'Tirar da agenda' })).toBeDisabled();
    await user.keyboard('{Escape}');
  });
});

describe('queued changes', () => {
  it('runs a second resize of the same block after the first, on what it left', async () => {
    const { backend } = await renderWeek({ items: [block()] });
    backend.latencyMs = 200;
    const handle = () =>
      must(document.querySelector<HTMLElement>(`[data-resize-handle="${block().id}"]`));

    await drag(handle(), { x: 5, y: 5 + 24 });
    await drag(handle(), { x: 5, y: 5 + 24 });

    await waitFor(() => {
      expect(backend.bodies).toEqual([{ endTime: '11:30' }, { endTime: '12:00' }]);
    });
  });
});

describe('focus after a removal', () => {
  it('goes to the next ficha, or the list of the day when it was the last', async () => {
    const { user } = await renderWeek({
      items: [
        entry({ id: 'e1', sortOrder: 0 }),
        entry({ id: 'e2', taskId: smash.id, sortOrder: 1 }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Tirar Lixar parede da lista do dia' }));
    await waitFor(() => {
      expect(
        within(strip('2026-11-18')).getByRole('article', { name: 'Quebrar piso' }),
      ).toHaveFocus();
    });

    await user.click(screen.getByRole('button', { name: 'Tirar Quebrar piso da lista do dia' }));
    await waitFor(() => {
      expect(strip('2026-11-18')).toHaveFocus();
    });
  });

  it('goes to the next block, or the day when it was the last', async () => {
    const { user } = await renderWeek({
      items: [
        block(),
        block({
          id: 'e0000000-0000-4000-8000-0000000000b2',
          taskId: smash.id,
          startTime: '13:00',
          endTime: '14:00',
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }));
    await user.click(screen.getByRole('button', { name: 'Tirar da agenda' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Quebrar piso, 13:00 – 14:00' })).toHaveFocus();
    });

    await user.click(screen.getByRole('button', { name: 'Quebrar piso, 13:00 – 14:00' }));
    await user.click(screen.getByRole('button', { name: 'Tirar da agenda' }));
    await waitFor(() => {
      expect(agenda('2026-11-17')).toHaveFocus();
    });
  });

  it('goes to the next event, or the day, after deleting from the popover', async () => {
    const { user } = await renderWeek({
      events: [
        daily,
        {
          ...daily,
          id: 'f0000000-0000-4000-8000-0000000000d2',
          title: 'Retro',
          startTime: '14:00',
          endTime: '15:00',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retro, 14:00 – 15:00' })).toHaveFocus();
    });

    await user.click(screen.getByRole('button', { name: 'Retro, 14:00 – 15:00' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(agenda('2026-11-17')).toHaveFocus();
    });
  });

  it('goes to the next tray item after archiving from the panel', async () => {
    navigateTo(`/semana?tarefa=${sand.id}`);
    const { user } = await renderWeek();
    const panel = await screen.findByRole('complementary', { name: 'Tarefa' });

    await user.click(within(panel).getByRole('button', { name: 'Ações da tarefa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement?.closest('[aria-label="Para planejar"]')).not.toBeNull();
    });
  });

  it('finds the block of the task when the panel closes', async () => {
    const { user } = await renderWeek({ items: [block({ taskId: sand.id })] });

    await user.click(screen.getByRole('button', { name: /^Lixar parede, / }));
    await user.click(await screen.findByRole('button', { name: 'Abrir tarefa Lixar parede' }));
    await screen.findByRole('complementary', { name: 'Tarefa' });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        document.activeElement?.getAttribute('data-task-id') ??
          document.activeElement?.getAttribute('data-block-task-id'),
      ).toBe(sand.id);
    });
  });
});

describe('the event popover', () => {
  it('follows its event when the page scrolls, and closes when focus leaves it', async () => {
    const { user } = await renderWeek({ events: [daily] });
    let top = 100;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.hasAttribute('data-event-id')) return new DOMRect(10, top, 80, 20);
      return new DOMRect(0, 0, 100, 20);
    });

    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compromisso' });
    const before = dialog.style.top;

    top = 300;
    act(() => {
      fireEvent.scroll(window);
    });
    await waitFor(() => {
      expect(dialog.style.top).not.toBe(before);
    });

    await user.click(
      within(trayItem('Lixar parede')).getByRole('button', {
        name: 'Ações da tarefa Lixar parede',
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
