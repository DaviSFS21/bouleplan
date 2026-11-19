import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { problemResponse } from '@/test/fixtures';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import {
  NOW,
  agenda,
  block,
  daily,
  entry,
  finished,
  must,
  paint,
  plannerWorld,
  sand,
  smash,
  strip,
  tray,
  trayItem,
  trayTitles,
} from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { serveTaskApi } from '@/test/task-backend';
import { reforma } from '@/test/task-world';
import { PlannerScreen } from './planner-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/semana');
});

afterEach(() => {
  navigateTo('/');
});

async function renderWeek(
  world: Parameters<typeof servePlannerApi>[0] = {},
  tasks: Partial<Parameters<typeof serveTaskApi>[0]> = {},
) {
  const taskBackend = serveTaskApi({ ...plannerWorld, ...tasks });
  const backend = servePlannerApi(world, taskBackend);
  renderWithQuery(<PlannerScreen now={NOW} />);
  await screen.findByRole('heading', { level: 1 });
  return { backend, taskBackend, user: userEvent.setup() };
}

describe('the week header and navigation', () => {
  it('shows the week number, the range and the three controls', async () => {
    await renderWeek();

    expect(screen.getByText('Semana 47')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '16 a 22 de novembro' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hoje' })).toBeVisible();
  });

  it('goes to the next and the previous week, keeping the address in step', async () => {
    const { user } = await renderWeek();

    await user.click(screen.getByRole('button', { name: 'Próxima semana' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '23 a 29 de novembro' }),
    ).toBeVisible();
    expect(window.location.search).toBe('?semana=2026-11-23');
    expect(screen.getByText('Semana 48')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '9 a 15 de novembro' }),
    ).toBeVisible();
    expect(window.location.search).toBe('?semana=2026-11-09');
  });

  it('comes back to this week with "Hoje", leaving no week in the address', async () => {
    navigateTo('/semana?semana=2026-12-28');
    const { user } = await renderWeek();
    expect(
      screen.getByRole('heading', { level: 1, name: '28 de dezembro a 3 de janeiro' }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '16 a 22 de novembro' }),
    ).toBeVisible();
    expect(window.location.search).toBe('');
  });

  it('opens the week of the address', async () => {
    navigateTo('/semana?semana=2026-11-23');
    const first = await renderWeek();
    expect(screen.getByRole('heading', { level: 1, name: '23 a 29 de novembro' })).toBeVisible();
    expect(first.user).toBeDefined();
  });

  it.each(['2026-11-17', 'lixo', '2026-13-45'])('falls back to this week for %s', async (value) => {
    navigateTo(`/semana?semana=${value}`);
    await renderWeek();

    expect(screen.getByRole('heading', { level: 1, name: '16 a 22 de novembro' })).toBeVisible();
  });

  it('stops stepping at the end of the supported years', async () => {
    navigateTo('/semana?semana=9999-12-27');
    await renderWeek();

    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeDisabled();
  });
});

describe('loading and failing', () => {
  it('shows a loading state while the week loads', async () => {
    serveTaskApi(plannerWorld);
    server.use(
      http.get('*/api/planner', async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json({ weekStart: '2026-11-16', events: [], items: [] });
      }),
    );
    renderWithQuery(<PlannerScreen now={NOW} />);

    expect(await screen.findByRole('status', { name: 'Carregando a semana' })).toBeVisible();
    await screen.findByRole('heading', { level: 1 });
  });

  it('says so when the week fails and tries again', async () => {
    const user = userEvent.setup();
    serveTaskApi(plannerWorld);
    let healthy = false;
    server.use(
      http.get('*/api/planner', () =>
        healthy
          ? HttpResponse.json({ weekStart: '2026-11-16', events: [], items: [] })
          : problemResponse('internal', 500),
      ),
    );
    renderWithQuery(<PlannerScreen now={NOW} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a semana.',
    );
    healthy = true;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
  });
});

describe('the agenda', () => {
  it('shows seven days with their numbers, weekdays and the lists above the hours', async () => {
    await renderWeek();

    const week = screen.getByRole('group', { name: 'Semana 47' });
    for (const label of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']) {
      expect(within(week).getByText(label)).toBeVisible();
    }
    expect(within(week).getByText('22')).toBeVisible();
    expect(screen.getByRole('group', { name: 'terça-feira, 17 de novembro' })).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Lista de terça-feira, 17 de novembro' }),
    ).toBeVisible();
    expect(within(week).getAllByText('sem horário')).toHaveLength(7);
  });

  it('marks only today', async () => {
    await renderWeek();

    const week = screen.getByRole('group', { name: 'Semana 47' });
    expect(within(week).getByText('17').parentElement).toHaveAttribute('aria-current', 'date');
    expect(within(week).getByText('18').parentElement).not.toHaveAttribute('aria-current');
  });

  it('labels the whole day, from 0h to 24h', async () => {
    await renderWeek();

    const labels = Array.from(document.querySelectorAll('[data-hour]')).map(
      (element) => element.textContent,
    );
    expect(labels).toHaveLength(25);
    expect(labels[0]).toBe('0h');
    expect(labels[8]).toBe('8h');
    expect(labels.at(-1)).toBe('24h');
    expect(agenda('2026-11-17').style.height).toBe(`${String(24 * 48)}px`);
  });

  it('opens the week on 8h', async () => {
    await renderWeek();

    expect(screen.getByRole('group', { name: 'Semana 47' }).scrollTop).toBe(384);
  });

  it('shades the hours outside 8h to 21h', async () => {
    await renderWeek();

    const before = agenda('2026-11-17').querySelector<HTMLElement>('[data-shade="before"]');
    const after = agenda('2026-11-17').querySelector<HTMLElement>('[data-shade="after"]');
    expect(before).toHaveStyle({ top: '0px', height: '384px' });
    expect(after).toHaveStyle({ bottom: '0px', height: '144px' });
  });

  it('keeps early and late time where it is, without growing the day', async () => {
    await renderWeek({
      items: [block({ startTime: '06:30', endTime: '07:15' })],
      events: [{ ...daily, startTime: '22:00', endTime: '22:30' }],
    });

    expect(screen.getByRole('button', { name: 'Comprar tinta, 6:30 – 7:15' })).toHaveStyle({
      top: '312px',
    });
    expect(screen.getByRole('button', { name: 'Daily, 22:00 – 22:30' })).toHaveStyle({
      top: '1056px',
    });
    expect(agenda('2026-11-17').style.height).toBe(`${String(24 * 48)}px`);
  });

  it('draws the now line outside the focal hours without moving the day', async () => {
    vi.setSystemTime(new Date(2026, 10, 17, 21, 10));
    navigateTo('/semana');
    serveTaskApi(plannerWorld);
    servePlannerApi({});
    renderWithQuery(<PlannerScreen now={new Date(2026, 10, 17, 21, 10)} />);
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('img', { name: 'agora, 21:10' })).toHaveStyle({ top: '1016px' });
    expect(screen.getByRole('group', { name: 'Semana 47' }).scrollTop).toBe(1016);
    expect(agenda('2026-11-17').style.height).toBe(`${String(24 * 48)}px`);
    vi.useRealTimers();
  });

  it('draws the fixed event, the dedicated block with its priority and the lists', async () => {
    await renderWeek({
      events: [daily],
      items: [block(), entry()],
    });

    const event = screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' });
    expect(event).toHaveStyle({ top: '432px', height: '20px' });
    expect(event).toHaveTextContent('Daily');
    expect(event).not.toHaveTextContent('9:00');

    const dedicated = screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' });
    expect(dedicated).toHaveStyle({ top: '432px', height: '92px' });
    expect(dedicated.querySelector('[data-priority]')).toHaveAttribute('data-priority', 'P1');

    const list = screen.getByRole('region', { name: 'Lista de quarta-feira, 18 de novembro' });
    expect(within(list).getByRole('article', { name: 'Lixar parede' })).toBeVisible();
  });

  it('draws the now line only today, at the current time', async () => {
    await renderWeek();

    const now = screen.getByRole('img', { name: 'agora, 11:45' });
    expect(now).toHaveStyle({ top: '564px' });
    expect(within(agenda('2026-11-17')).getByRole('img', { name: 'agora, 11:45' })).toBe(now);
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('shows no now line in another week', async () => {
    navigateTo('/semana?semana=2026-11-23');
    await renderWeek();

    expect(screen.queryByRole('img', { name: /agora/ })).not.toBeInTheDocument();
  });

  it('leaves out the items of hidden tasks', async () => {
    await renderWeek({
      items: [block({ taskId: 'a1a1a1a1-0000-4000-8000-0000000000ff' })],
    });

    expect(screen.queryByRole('button', { name: /^Comprar tinta, / })).not.toBeInTheDocument();
  });
});

describe('deadline lines', () => {
  it('puts the line of a task at the end of the day of its deadline, above the blocks', async () => {
    await renderWeek();

    const thursday = within(agenda('2026-11-19'));
    expect(thursday.getByRole('button', { name: /^prazo · Comprar tinta/ })).toBeVisible();
    const line = thursday.getByRole('button', { name: /^prazo · Comprar tinta/ }).parentElement;
    expect(line).toHaveStyle({ bottom: '144px' });
    const wednesday = within(agenda('2026-11-18'));
    expect(
      wednesday.getByRole('button', { name: 'prazo · Plantar alface · faltam 1,5h' }),
    ).toBeVisible();
  });

  it('shows no line for done tasks or deadlines outside the week', async () => {
    await renderWeek();

    expect(screen.queryByText('prazo · Pedir orçamento')).not.toBeInTheDocument();
    expect(screen.queryByText(/prazo · Quebrar piso/)).not.toBeInTheDocument();
  });

  it('names what is missing for the task at risk, or that nothing is reserved', async () => {
    await renderWeek();
    expect(screen.getByRole('button', { name: 'prazo · Comprar tinta · faltam 4h' })).toBeVisible();
  });

  it('keeps the plain label once the deadline is covered', async () => {
    await renderWeek({
      items: [block({ date: '2026-11-18', startTime: '08:00', endTime: '12:00' })],
    });

    expect(await screen.findByRole('button', { name: 'prazo · Comprar tinta' })).toBeVisible();
  });

  it('says "sem tempo reservado" for a task without an estimate', async () => {
    const loose = { ...sand, deadline: '2026-11-20' };
    await renderWeek({}, { tasks: [paint, loose] });

    expect(
      screen.getByRole('button', { name: 'prazo · Lixar parede · sem tempo reservado' }),
    ).toBeVisible();
  });

  it('opens the task of a line', async () => {
    const { user } = await renderWeek();

    await user.click(screen.getByRole('button', { name: 'prazo · Comprar tinta · faltam 4h' }));

    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
    expect(window.location.search).toBe(`?tarefa=${paint.id}`);
  });
});

describe('the tray', () => {
  it('lists the open tasks, planned first, then by priority and nearest deadline, none last', async () => {
    await renderWeek(
      {},
      {
        tasks: [
          { ...smash, plannedWeekStart: '2026-11-16' },
          paint,
          sand,
          finished,
          {
            ...smash,
            id: 'x',
            title: 'Sem prazo',
            priority: 'P2',
            deadline: null,
            plannedWeekStart: null,
          },
        ],
      },
    );

    expect(trayTitles()).toEqual(['Quebrar piso', 'Comprar tinta', 'Sem prazo', 'Lixar parede']);
  });

  it('shows what is left to reserve in the words of the design', async () => {
    await renderWeek(
      {
        items: [
          block({ id: 'b1', startTime: '09:00', endTime: '10:30' }),
          block({ id: 'b2', taskId: smash.id, startTime: '13:00', endTime: '15:00' }),
        ],
      },
      { tasks: [{ ...paint, deadline: null }, sand, smash] },
    );

    expect(trayItem('Comprar tinta')).toHaveTextContent('2,5h a reservar de 4h');
    expect(trayItem('Lixar parede')).toHaveTextContent('sem estimativa');
    expect(trayItem('Quebrar piso')).toHaveTextContent('tudo reservado');
    expect(trayItem('Quebrar piso')).toHaveClass(/full/);
  });

  it('shows the plain remaining time when nothing is reserved, and the selo and blocked state', async () => {
    await renderWeek({}, { tasks: [{ ...smash, isBlocked: true }] });

    const item = trayItem('Quebrar piso');
    expect(item).toHaveTextContent('2h a reservar');
    expect(within(item).getByText('P2')).toBeVisible();
    expect(within(item).getByText('Bloqueada')).toBeVisible();
  });

  it('filters by initiative with pressed pills', async () => {
    const { user } = await renderWeek();
    const pills = within(screen.getByRole('group', { name: 'Filtrar por iniciativa' }));
    expect(pills.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(pills.getByRole('button', { name: 'Horta' }));

    expect(pills.getByRole('button', { name: 'Horta' })).toHaveAttribute('aria-pressed', 'true');
    expect(pills.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    expect(trayTitles()).toEqual(['Plantar alface']);

    await user.click(pills.getByRole('button', { name: 'Todas' }));
    expect(trayTitles()).toHaveLength(4);
  });

  it('opens the task from the tray, and from the keyboard with Enter', async () => {
    const { user } = await renderWeek();

    await user.click(trayItem('Lixar parede'));
    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
    expect(trayItem('Lixar parede')).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    });

    trayItem('Quebrar piso').focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
    expect(window.location.search).toBe(`?tarefa=${smash.id}`);
  });

  it('says so when there is nothing to plan', async () => {
    await renderWeek({}, { tasks: [finished] });

    expect(within(tray()).getByText('Nenhuma tarefa para planejar.')).toBeVisible();
  });
});

describe('strips and fichas', () => {
  it('shows each ficha with its priority, title and what is left to reserve', async () => {
    await renderWeek(
      {
        items: [
          block({ id: 'b1', startTime: '09:00', endTime: '10:30' }),
          entry({ id: 'e1', taskId: sand.id, sortOrder: 1 }),
          entry({ id: 'e2', taskId: paint.id, sortOrder: 2 }),
          entry({ id: 'e3', taskId: smash.id, sortOrder: 3 }),
        ],
      },
      { tasks: [paint, sand, smash] },
    );

    const list = within(strip('2026-11-18'));
    const sandCard = list.getByRole('article', { name: 'Lixar parede' });
    expect(sandCard).toHaveTextContent('sem estimativa');
    expect(within(sandCard).getByText('P3')).toBeVisible();
    expect(list.getByRole('article', { name: 'Comprar tinta' })).toHaveTextContent('2,5h');
    expect(list.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Lixar parede',
      'Comprar tinta',
      'Quebrar piso',
    ]);
  });

  it('shows the total of the day and counts the tasks without an estimate', async () => {
    await renderWeek({
      items: [
        entry({ id: 'e1', taskId: sand.id, sortOrder: 1 }),
        entry({ id: 'e2', taskId: paint.id, sortOrder: 2 }),
        entry({ id: 'e3', taskId: smash.id, sortOrder: 3 }),
      ],
    });

    const list = strip('2026-11-18');
    expect(list).toHaveTextContent('6h sem horário');
    expect(list).toHaveTextContent('+1 sem estimativa');
    expect(strip('2026-11-19')).toHaveTextContent('sem horário');
  });

  it('opens the task of a ficha by click and by Enter, but not from its remove button', async () => {
    const { user } = await renderWeek({ items: [entry()] });
    const ficha = within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' });

    await user.click(ficha);
    expect(window.location.search).toBe(`?tarefa=${sand.id}`);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });

    ficha.focus();
    await user.keyboard('{Enter}');
    expect(window.location.search).toBe(`?tarefa=${sand.id}`);
  });
});

function alertStrip() {
  return (
    screen.queryByText('Prazos sem tempo reservado.')?.closest<HTMLElement>('[role="status"]') ??
    null
  );
}

describe('the deadline-without-reserved-time alert', () => {
  it('warns about the tasks due this week that still lack reserved time', async () => {
    await renderWeek();

    expect(alertStrip()).toHaveTextContent(
      'Prazos sem tempo reservado. 2 tarefas vencem nesta semana com tempo a reservar.',
    );
    expect(
      within(must(alertStrip())).getByRole('button', { name: 'Mostrar na bandeja' }),
    ).toBeVisible();
  });

  it('uses the singular for one task, and counts only what is not covered by the deadline', async () => {
    await renderWeek({
      items: [
        block({
          id: 'b9',
          taskId: 'a1a1a1a1-0000-4000-8000-000000000003',
          date: '2026-11-18',
          startTime: '08:00',
          endTime: '09:30',
        }),
      ],
    });

    expect(alertStrip()).toHaveTextContent('1 tarefa vence nesta semana com tempo a reservar.');
  });

  it('is hidden when no task is at risk, and so is its pill', async () => {
    await renderWeek({}, { tasks: [sand, smash] });

    expect(alertStrip()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sem tempo reservado' })).not.toBeInTheDocument();
  });

  it('is calm about a block that comes after the deadline', async () => {
    await renderWeek({
      items: [block({ date: '2026-11-20', startTime: '08:00', endTime: '12:00' })],
    });

    expect(alertStrip()).toHaveTextContent('2 tarefas');
  });

  it('shows the at-risk tasks in the tray with the attention wording', async () => {
    await renderWeek();

    const item = trayItem('Comprar tinta');
    expect(within(item).getByText('vence qui · faltam 4h')).toHaveClass(/alert/);
    expect(within(trayItem('Plantar alface')).getByText('vence qua · faltam 1,5h')).toBeVisible();
    expect(within(trayItem('Quebrar piso')).queryByText(/vence/)).not.toBeInTheDocument();
  });

  it('says "hoje" for a deadline today and "sem tempo reservado" without an estimate', async () => {
    await renderWeek(
      {},
      {
        tasks: [
          { ...paint, deadline: '2026-11-17' },
          { ...sand, deadline: '2026-11-21' },
        ],
      },
    );

    expect(trayItem('Comprar tinta')).toHaveTextContent('vence hoje · faltam 4h');
    expect(trayItem('Lixar parede')).toHaveTextContent('vence sáb · sem tempo reservado');
  });

  it('shows them in the tray on demand, with a pressed pill that goes away with the alert', async () => {
    const { user } = await renderWeek();

    await user.click(screen.getByRole('button', { name: 'Mostrar na bandeja' }));

    const pill = screen.getByRole('button', { name: 'Sem tempo reservado' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    expect(trayTitles()).toEqual(['Comprar tinta', 'Plantar alface']);

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(trayTitles()).toHaveLength(4);
  });

  it('does not look at another week before today', async () => {
    navigateTo('/semana?semana=2026-11-09');
    await renderWeek();

    expect(alertStrip()).toBeNull();
  });
});

describe('the alert region', () => {
  it('is mounted and empty without an alert', async () => {
    await renderWeek({}, { tasks: [sand, smash] });

    expect(screen.getByRole('status', { name: 'Alertas da semana' })).toBeEmptyDOMElement();
  });

  it('is filled when the alert appears', async () => {
    await renderWeek();

    expect(screen.getByRole('status', { name: 'Alertas da semana' })).toHaveTextContent(
      'Prazos sem tempo reservado.',
    );
  });
});

describe('the task panel on the week page', () => {
  it('opens from the deep link, with its dedicated time listed', async () => {
    navigateTo(`/semana?tarefa=${paint.id}`);
    await renderWeek({ items: [block()] });

    const panel = await screen.findByRole('complementary', { name: 'Tarefa' });
    expect(await within(panel).findByText('9:00 – 11:00 · 2h')).toBeVisible();
    expect(within(panel).getByText('2h de 4h reservadas')).toBeVisible();
    expect(within(panel).getByText('ter, 17 nov')).toBeVisible();
  });

  it('drops a link to a task that does not exist', async () => {
    navigateTo('/semana?tarefa=a1a1a1a1-0000-4000-8000-0000000000ee&semana=2026-11-16');
    await renderWeek();

    await waitFor(() => {
      expect(window.location.search).toBe('?semana=2026-11-16');
    });
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('edits the task from the panel and offers "Pôr na lista de hoje" in its menu', async () => {
    navigateTo(`/semana?tarefa=${sand.id}`);
    const { user, backend } = await renderWeek();
    const panel = await screen.findByRole('complementary', { name: 'Tarefa' });

    await user.click(within(panel).getByRole('button', { name: 'Ações da tarefa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Pôr na lista de hoje' }));

    expect(
      await within(strip('2026-11-17')).findByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ taskId: sand.id, date: '2026-11-17' }]);
    expect(await screen.findByText('Tarefa na lista de hoje')).toBeVisible();

    await user.click(within(panel).getByRole('button', { name: 'Ações da tarefa' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Pôr na lista de hoje' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('closes the panel when its task is archived and brings it back on undo', async () => {
    navigateTo(`/semana?tarefa=${sand.id}`);
    const { user } = await renderWeek();
    const panel = await screen.findByRole('complementary', { name: 'Tarefa' });

    await user.click(within(panel).getByRole('button', { name: 'Ações da tarefa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    });
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
  });

  it('goes to the board from the path of the task', async () => {
    navigateTo(`/semana?tarefa=${paint.id}`);
    const { user } = await renderWeek();
    const panel = await screen.findByRole('complementary', { name: 'Tarefa' });

    await user.click(within(panel).getByRole('link', { name: 'Reforma' }));

    expect(window.location.pathname + window.location.search).toBe(`/?iniciativa=${reforma.id}`);
  });
});

describe('focus and links of the panel', () => {
  it('returns focus to the tray item when the panel closes', async () => {
    const { user } = await renderWeek();

    await user.click(trayItem('Lixar parede'));
    await screen.findByRole('complementary', { name: 'Tarefa' });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(trayItem('Lixar parede')).toHaveFocus();
    });
  });

  it('opens a related task from the panel and keeps the link of a task closed meanwhile', async () => {
    navigateTo(`/semana?tarefa=${paint.id}`);
    const { user } = await renderWeek(
      {},
      {
        tasks: [
          { ...paint, blocks: [sand.id] },
          { ...sand, blockedBy: [paint.id] },
        ],
      },
    );
    const panel = await screen.findByRole('complementary', { name: 'Tarefa' });

    await user.click(
      within(within(panel).getByRole('group', { name: 'Bloqueia' })).getByRole('button', {
        name: 'Lixar parede',
      }),
    );

    await waitFor(() => {
      expect(window.location.search).toBe(`?tarefa=${sand.id}`);
    });
  });

  it('keeps the panel of another task when an old one is closed', async () => {
    navigateTo(`/semana?tarefa=${paint.id}`);
    const { user } = await renderWeek();
    await screen.findByRole('complementary', { name: 'Tarefa' });

    await user.click(trayItem('Lixar parede'));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
  });
});
