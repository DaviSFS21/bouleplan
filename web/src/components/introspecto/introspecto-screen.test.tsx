import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { problemResponse } from '@/test/fixtures';
import { QUESTIONS, answered, serveIntrospectionApi, sheet } from '@/test/introspection-backend';
import {
  FRIDAY,
  PREVIOUS,
  TUESDAY,
  WEEK,
  boughtPaint,
  breaking,
  introspectoWorld,
  paintedRoom,
  renderSheet,
  sanding,
  section,
  summaryList,
} from '@/test/introspecto-world';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { serveTaskApi } from '@/test/task-backend';
import { reforma } from '@/test/task-world';
import { IntrospectoScreen } from './introspecto-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/introspecto');
});

afterEach(() => {
  navigateTo('/');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function answer(label: string) {
  return screen.getByRole('textbox', { name: label });
}

describe('the sheet header', () => {
  it('shows the overline, the period and that it is not started', async () => {
    await renderSheet();

    expect(screen.getByText('Introspecto · semana 47')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '16 a 22 de novembro' })).toBeVisible();
    expect(screen.getByText('Ainda não começada')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'A semana que passou' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'A próxima semana' })).toBeVisible();
    expect(within(section('A próxima semana')).getByText('23 a 29 de novembro')).toBeVisible();
  });

  it('shows when the draft was saved, in local time', async () => {
    await renderSheet({ sheets: [answered(WEEK, { went_well: 'Terminei a sala.' })] });

    expect(screen.getByText('Rascunho salvo às 18:42')).toBeVisible();
    expect(answer('O que foi bom?')).toHaveValue('Terminei a sala.');
  });

  it('shows when the sheet was closed', async () => {
    await renderSheet({
      sheets: [
        sheet(WEEK, {
          closedAt: '2026-11-23T08:00:00-03:00',
          updatedAt: '2026-11-22T20:00:00-03:00',
        }),
      ],
    });

    expect(screen.getByText('Fechada em 23 nov')).toBeVisible();
  });

  it('asks the three questions the server stored, in order, with the prompt as the label', async () => {
    await renderSheet({
      sheets: [
        sheet(WEEK, {
          answers: [
            { key: 'went_well', prompt: 'Pergunta antiga?', answer: '' },
            ...QUESTIONS.slice(1).map((question) => ({ ...question, answer: '' })),
          ],
        }),
      ],
    });

    const fields = screen.getAllByRole('textbox').map((field) => field.id);
    expect(fields).toHaveLength(3);
    expect(answer('Pergunta antiga?')).toBeVisible();
    expect(answer('O que foi ruim?')).toBeVisible();
    expect(answer('Como posso melhorar?')).toBeVisible();
    expect(screen.getAllByRole('textbox').map((field) => field.getAttribute('id'))).toEqual(fields);
  });
});

describe('which week it reviews', () => {
  it('reviews the current week from Friday to Sunday', async () => {
    for (const day of [20, 21, 22]) {
      const { backend } = await renderSheet({ now: new Date(2026, 10, day, 12) });
      expect(backend.calls).toContain(`GET ${WEEK}`);
      expect(screen.getByRole('heading', { level: 1, name: '16 a 22 de novembro' })).toBeVisible();
      cleanup();
    }
  });

  it('reviews the previous week from Monday to Thursday', async () => {
    const { backend } = await renderSheet({ now: TUESDAY });

    expect(backend.calls).toContain(`GET ${PREVIOUS}`);
    expect(screen.getByText('Introspecto · semana 46')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '9 a 15 de novembro' })).toBeVisible();
    expect(within(section('A próxima semana')).getByText('16 a 22 de novembro')).toBeVisible();
  });

  it('takes the week from the URL when it is a Monday', async () => {
    navigateTo(`/introspecto?semana=${PREVIOUS}`);
    const { backend } = await renderSheet();

    expect(backend.calls).toContain(`GET ${PREVIOUS}`);
    expect(screen.getByRole('heading', { level: 1, name: '9 a 15 de novembro' })).toBeVisible();
  });

  it('falls back to the default week when the URL is not a Monday', async () => {
    navigateTo('/introspecto?semana=2026-11-17');
    const { backend } = await renderSheet();

    expect(backend.calls).toContain(`GET ${WEEK}`);
  });
});

describe('the summary of the week that passed', () => {
  it('lists done tasks planned for the week or touched in it, and what was left behind', async () => {
    await renderSheet();

    const done = summaryList('Concluídas · 2');
    expect(done).toHaveTextContent('Pintar sala');
    expect(done).toHaveTextContent('Comprar sementes');
    expect(done).toHaveTextContent('Horta');
    expect(done).not.toHaveTextContent('Tarefa antiga');
    const behind = summaryList('Ficaram para trás · 2');
    expect(behind).toHaveTextContent('Lixar parede');
    expect(behind).toHaveTextContent('Reforma · prazo sáb, 14 nov');
    expect(within(behind).getByText('P1')).toBeVisible();
    expect(behind).toHaveTextContent('Quebrar piso');
    expect(behind).toHaveTextContent('sem prazo');
  });

  it('does not list a task twice', async () => {
    await renderSheet();

    expect(within(summaryList('Concluídas · 2')).getAllByText('Pintar sala')).toHaveLength(1);
    expect(within(section('A semana que passou')).getAllByText('Lixar parede')).toHaveLength(1);
  });

  it('leaves out tasks the API hides because they are archived or deleted', async () => {
    await renderSheet({
      world: { tasks: introspectoWorld.tasks.filter(({ id }) => id !== sanding.id) },
    });

    expect(summaryList('Ficaram para trás · 1')).toHaveTextContent(breaking.title);
    expect(screen.queryByText('Lixar parede')).not.toBeInTheDocument();
  });

  it('leaves out tasks of an initiative that is no longer listed', async () => {
    await renderSheet({ world: { initiatives: [reforma] } });

    expect(summaryList('Concluídas · 1')).toHaveTextContent('Pintar sala');
    expect(screen.queryByText('Comprar sementes')).not.toBeInTheDocument();
    expect(screen.queryByText('Plantar alface')).not.toBeInTheDocument();
  });

  it('counts the week by the local date of the last update', async () => {
    const lateSunday = { ...boughtPaint, updatedAt: '2026-11-22T23:30:00-03:00' };
    const earlyMonday = {
      ...paintedRoom,
      plannedWeekStart: null,
      updatedAt: '2026-11-23T00:30:00-03:00',
    };
    await renderSheet({
      world: { tasks: [lateSunday, earlyMonday] },
    });

    const done = summaryList('Concluídas · 1');
    expect(done).toHaveTextContent('Comprar sementes');
    expect(done).not.toHaveTextContent('Pintar sala');
  });
});

describe('autosave of the answers', () => {
  it('saves 800 ms after the last keystroke, only that answer', async () => {
    const { backend } = await renderSheet({ fake: true });
    // From here time moves only when the test moves it, so a slow machine cannot blur the 800 ms.
    vi.useFakeTimers();

    fireEvent.change(answer('O que foi bom?'), { target: { value: 'Terminei a sala.' } });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(backend.saves).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(backend.saves).toEqual([[{ key: 'went_well', answer: 'Terminei a sala.' }]]);
    });
    expect(await screen.findByText('Rascunho salvo às 18:42')).toBeVisible();
    expect(screen.queryByText('Ainda não começada')).not.toBeInTheDocument();
  });

  it('saves on blur at once and sends nothing when nothing changed', async () => {
    const { backend, user } = await renderSheet();

    await user.click(answer('O que foi ruim?'));
    await user.tab();
    expect(backend.saves).toHaveLength(0);

    await user.type(answer('O que foi ruim?'), 'Atrasei.');
    await user.tab();

    await waitFor(() => {
      expect(backend.saves).toEqual([[{ key: 'went_badly', answer: 'Atrasei.' }]]);
    });
    expect(answer('O que foi ruim?')).toHaveValue('Atrasei.');
  });

  it('keeps the text and shows the error when a delayed save fails, and tries again on blur', async () => {
    const { backend, user } = await renderSheet({ fake: true });
    backend.slowSave = { ms: 1500, fail: true };

    await user.type(answer('O que foi bom?'), 'Texto');
    await user.tab();
    await user.click(answer('O que foi bom?'));
    await user.type(answer('O que foi bom?'), ' mais');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar a resposta. Tente de novo.',
    );
    expect(answer('O que foi bom?')).toHaveValue('Texto mais');

    backend.slowSave = null;
    await user.tab();

    await waitFor(() => {
      expect(backend.saves.at(-1)).toEqual([{ key: 'went_well', answer: 'Texto mais' }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(answer('O que foi bom?')).toHaveValue('Texto mais');
  });

  it('shows the message of the server problem for a closed sheet', async () => {
    const { backend, user } = await renderSheet();
    let attempts = 0;
    server.use(
      http.put('*/api/introspections/:week', () => {
        attempts += 1;
        return problemResponse('introspection.closed', 409);
      }),
    );

    await user.type(answer('Como posso melhorar?'), 'Planejar.');
    await user.tab();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta folha já foi fechada e não muda mais.',
    );
    expect(backend.saves).toHaveLength(0);
    // Leaving tries the failed save once more, here, before the next test starts.
    cleanup();
    await waitFor(() => {
      expect(attempts).toBe(2);
    });
  });

  it('keeps each answer under its own question when two are saved in a row', async () => {
    const { backend, user } = await renderSheet();

    await user.type(answer('O que foi bom?'), 'Um');
    await user.type(answer('O que foi ruim?'), 'Dois');
    await user.tab();

    await waitFor(() => {
      expect(backend.saves).toHaveLength(2);
    });

    expect(answer('O que foi bom?')).toHaveValue('Um');
    expect(answer('O que foi ruim?')).toHaveValue('Dois');
    expect(backend.sheets.get(WEEK)?.answers.map(({ answer: text }) => text)).toEqual([
      'Um',
      'Dois',
      '',
    ]);
  });
});

describe('stale errors and the end of the page', () => {
  it('drops the error of a slow failing save once a later save is confirmed', async () => {
    const { backend } = await renderSheet({ fake: true });
    backend.slowSave = { ms: 1000, fail: true };

    fireEvent.change(answer('O que foi bom?'), { target: { value: 'Um' } });
    fireEvent.blur(answer('O que foi bom?'));
    backend.slowSave = null;
    fireEvent.change(answer('O que foi bom?'), { target: { value: 'Um dois' } });
    fireEvent.blur(answer('O que foi bom?'));

    await waitFor(() => {
      expect(backend.sheets.get(WEEK)?.answers[0]?.answer).toBe('Um dois');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(answer('O que foi bom?')).toHaveValue('Um dois');
  });

  it('keeps the spaces typed after an idle save, with the server trimming like the API', async () => {
    const { backend } = await renderSheet({ fake: true });

    fireEvent.change(answer('O que foi bom?'), { target: { value: 'hello ' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    await waitFor(() => {
      expect(backend.sheets.get(WEEK)?.answers[0]?.answer).toBe('hello');
    });
    fireEvent.change(answer('O que foi bom?'), { target: { value: 'hello world\n\n' } });

    expect(answer('O que foi bom?')).toHaveValue('hello world\n\n');
    fireEvent.blur(answer('O que foi bom?'));
    await waitFor(() => {
      expect(backend.sheets.get(WEEK)?.answers[0]?.answer).toBe('hello world');
    });
  });

  it('sends a pending answer with keepalive when the page is hidden', async () => {
    const { backend } = await renderSheet();
    const sentKeepalive: boolean[] = [];
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (input instanceof Request && input.method === 'PUT') sentKeepalive.push(input.keepalive);
      return realFetch(input, init);
    });

    fireEvent.change(answer('O que foi bom?'), { target: { value: 'Quase perdi.' } });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(() => {
      expect(backend.saves).toEqual([[{ key: 'went_well', answer: 'Quase perdi.' }]]);
    });
    expect(sentKeepalive).toEqual([true]);
    expect(await screen.findByText('Rascunho salvo às 18:42')).toBeVisible();
  });

  it('does not show an error when the keepalive request fails', async () => {
    const { backend } = await renderSheet();
    backend.failing.add('PUT');

    fireEvent.change(answer('O que foi bom?'), { target: { value: 'Quase perdi.' } });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(() => {
      expect(backend.saves).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a resposta');
    });
    // Leaving tries the failed save once more, here, before the next test starts.
    cleanup();
    await waitFor(() => {
      expect(backend.saves).toHaveLength(2);
    });
  });

  it('survives a keepalive request that cannot be sent', async () => {
    await renderSheet();
    server.use(http.put('*/api/introspections/:week', () => HttpResponse.error()));

    fireEvent.change(answer('O que foi bom?'), { target: { value: 'Quase perdi.' } });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
  });
});

describe('closing the sheet', () => {
  it('moves focus to the note that replaces the button', async () => {
    const { user } = await renderSheet();

    await user.click(screen.getByRole('button', { name: 'Fechar o Introspecto' }));

    const note = await screen.findByText('Esta folha foi fechada e não muda mais.');
    expect(note).toHaveFocus();
  });

  it('does not take focus when the sheet was already closed on arrival', async () => {
    await renderSheet({ sheets: [sheet(WEEK, { closedAt: '2026-11-21T08:00:00-03:00' })] });

    expect(screen.getByText('Esta folha foi fechada e não muda mais.')).not.toHaveFocus();
  });

  it('freezes the answers while it closes', async () => {
    const { backend, user } = await renderSheet();
    backend.slowSave = { ms: 300, fail: false };

    await user.type(answer('O que foi bom?'), 'Terminei.');
    await user.click(screen.getByRole('button', { name: 'Fechar o Introspecto' }));

    expect(answer('O que foi bom?')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Fechar o Introspecto' })).toBeDisabled();
    expect(await screen.findByText(/^Fechada em /)).toBeVisible();
  });

  it('saves a pending answer first, then closes and turns read-only', async () => {
    const { backend, user } = await renderSheet();

    await user.type(answer('O que foi bom?'), 'Terminei.');
    await user.click(screen.getByRole('button', { name: 'Fechar o Introspecto' }));

    await waitFor(() => {
      expect(screen.getByText('Fechada em 17 nov')).toBeVisible();
    });
    expect(
      backend.calls.filter((call) => call.startsWith('PUT') || call.startsWith('POST')),
    ).toEqual([`PUT ${WEEK}`, `POST ${WEEK}`]);
    expect(backend.sheets.get(WEEK)?.answers[0]?.answer).toBe('Terminei.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'O que foi bom?' })).toHaveTextContent('Terminei.');
    expect(screen.getByRole('group', { name: 'O que foi ruim?' })).toHaveTextContent(
      'Sem resposta.',
    );
    expect(screen.queryByRole('button', { name: 'Fechar o Introspecto' })).not.toBeInTheDocument();
    expect(screen.getByText('Esta folha foi fechada e não muda mais.')).toBeVisible();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
  });

  it('shows the footer note and the button on a draft', async () => {
    await renderSheet();

    expect(
      screen.getByText('Ao fechar, a folha vai para o histórico e não muda mais.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fechar o Introspecto' })).toBeEnabled();
  });

  it('does not close when a pending answer cannot be saved', async () => {
    const { backend, user } = await renderSheet();
    backend.failing.add('PUT');

    await user.type(answer('O que foi bom?'), 'Terminei.');
    await user.click(screen.getByRole('button', { name: 'Fechar o Introspecto' }));

    expect(
      await screen.findByText(
        'Não foi possível salvar as respostas, então a folha não foi fechada.',
      ),
    ).toBeVisible();
    expect(backend.calls.some((call) => call.startsWith('POST'))).toBe(false);
    expect(answer('O que foi bom?')).toHaveValue('Terminei.');
    expect(screen.getByRole('button', { name: 'Fechar o Introspecto' })).toBeEnabled();
  });

  it('shows the error and stays a draft when closing fails', async () => {
    const { backend, user } = await renderSheet();
    backend.failing.add('POST');

    await user.click(screen.getByRole('button', { name: 'Fechar o Introspecto' }));

    expect(
      await screen.findByText('Não foi possível fechar o Introspecto. Tente de novo.'),
    ).toBeVisible();
    expect(answer('O que foi bom?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fechar o Introspecto' })).toBeEnabled();
  });

  it('says the sheet is already closed when another window closed it', async () => {
    const { backend, user } = await renderSheet();
    backend.sheets.set(WEEK, sheet(WEEK, { closedAt: '2026-11-21T08:00:00-03:00' }));
    await user.click(screen.getByRole('button', { name: 'Fechar o Introspecto' }));

    expect(await screen.findByText('Esta folha já foi fechada e não muda mais.')).toBeVisible();
  });
});

describe('moving between weeks', () => {
  it('goes back a week and forward again, and drops the parameter on the default week', async () => {
    const { user } = await renderSheet();

    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));

    expect(window.location.search).toBe(`?semana=${PREVIOUS}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: '9 a 15 de novembro' }),
    ).toBeVisible();
    expect(screen.getByText('Introspecto · semana 46')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Próxima semana' }));

    expect(window.location.search).toBe('');
    expect(
      await screen.findByRole('heading', { level: 1, name: '16 a 22 de novembro' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeDisabled();
  });

  it('falls back to the default week when the URL asks for a week that has not started', async () => {
    navigateTo('/introspecto?semana=2026-11-30');
    const { backend } = await renderSheet();

    expect(backend.calls).toEqual(expect.arrayContaining([`GET ${WEEK}`]));
    expect(backend.calls).not.toContain('GET 2026-11-30');
    expect(screen.getByRole('heading', { level: 1, name: '16 a 22 de novembro' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeDisabled();
  });

  it('saves a pending answer of the week it leaves, to that week', async () => {
    const { backend, user } = await renderSheet();

    await user.type(answer('O que foi bom?'), 'Antes de sair.');
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));

    await waitFor(() => {
      expect(backend.sheets.get(WEEK)?.answers[0]?.answer).toBe('Antes de sair.');
    });
    expect(backend.sheets.get(PREVIOUS)).toBeUndefined();
  });

  it('keeps the other parameters when it moves', async () => {
    navigateTo('/introspecto?x=1');
    const { user } = await renderSheet();

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));

    expect(window.location.search).toBe(`?x=1&semana=${PREVIOUS}`);
  });

  it('has no week before year 1 and no planning after year 9999', async () => {
    navigateTo('/introspecto?semana=0001-01-01');
    const first = await renderSheet();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeDisabled();
    expect(first.backend.calls).toContain('GET 0001-01-01');
    cleanup();

    navigateTo('/introspecto');
    // The last Friday the calendar has: its week has no week after it.
    await renderSheet({ now: new Date(9999, 11, 31, 10) });
    expect(screen.queryByRole('region', { name: 'A próxima semana' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'A semana que passou' })).toBeVisible();
  });
});

describe('loading', () => {
  it('shows the loading state, then the sheet', async () => {
    serveTaskApi(introspectoWorld);
    serveIntrospectionApi();
    renderWithQuery(<IntrospectoScreen now={FRIDAY} />);

    expect(screen.getByRole('status', { name: 'Carregando o Introspecto' })).toBeVisible();
    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
  });

  it('shows an error with a retry when the sheet cannot be read', async () => {
    serveTaskApi(introspectoWorld);
    const backend = serveIntrospectionApi();
    backend.failing.add('GET');
    const user = userEvent.setup();
    renderWithQuery(<IntrospectoScreen now={FRIDAY} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o Introspecto.',
    );

    backend.failing.delete('GET');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
  });

  it('shows an error when the tasks cannot be read', async () => {
    serveTaskApi(introspectoWorld);
    server.use(http.get('*/api/tasks', () => HttpResponse.json({}, { status: 500 })));
    serveIntrospectionApi();
    renderWithQuery(<IntrospectoScreen now={FRIDAY} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o Introspecto.',
    );
  });
});
