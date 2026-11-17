import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { ToastProvider } from '@/components/toast/toast';
import { useTasks } from '@/api/tasks';
import { task } from '@/test/fixtures';
import { serveTaskApi } from '@/test/task-backend';
import { reforma } from '@/test/task-world';
import { useTaskActions } from './use-task-actions';

const paint = task({ id: 'a1a1a1a1-0000-4000-8000-000000000001', title: 'Pintar' });

function setup(openId: string | null = null) {
  const backend = serveTaskApi({ initiatives: [reforma], tasks: [paint] });
  const panel = {
    openId,
    open: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    selectPath: vi.fn(),
  };
  const report = vi.fn();
  const addToToday = vi.fn();
  const rendered = renderHook(
    () => ({
      tasks: useTasks(),
      week: useTaskActions({
        panel,
        report,
        extra: { onAddToToday: addToToday, isInTodayList: () => false },
      }),
    }),
    {
      wrapper: ({ children }: Readonly<{ children: ReactNode }>) => (
        <QueryClientProvider client={createQueryClient({ retry: false })}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      ),
    },
  );
  return { backend, panel, report, addToToday, ...rendered };
}

describe('useTaskActions', () => {
  it('opens the panel, asking for focus only from the keyboard, and closes it', () => {
    const { result, panel } = setup();

    act(() => {
      result.current.week.actions.onOpen(paint);
    });
    expect(panel.open).toHaveBeenCalledWith(paint.id);
    expect(result.current.week.panelFocus).toBe(0);

    act(() => {
      result.current.week.actions.onOpen(paint, true);
    });
    expect(result.current.week.panelFocus).toBe(1);

    act(() => {
      result.current.week.actions.onClose();
      result.current.week.focusPanel();
    });
    expect(panel.close).toHaveBeenCalledWith();
    expect(result.current.week.panelFocus).toBe(2);
  });

  it('refuses a blank title and renames otherwise', async () => {
    const { result, report, backend } = setup();

    act(() => {
      result.current.week.actions.onRename(paint, '');
    });
    expect(report).toHaveBeenCalledWith('Dê um título à tarefa.');

    act(() => {
      result.current.week.actions.onRename(paint, 'Novo');
    });
    await waitFor(() => {
      expect(backend.bodies).toEqual([{ title: 'Novo' }]);
    });
  });

  it('changes the priority only when it differs, and toggles the block', async () => {
    const { result, backend } = setup();

    act(() => {
      result.current.week.actions.onPriority(paint, 'P2');
      result.current.week.actions.onPriority(paint, 'P1');
      result.current.week.actions.onToggleBlocked(paint);
    });

    await waitFor(() => {
      expect(backend.bodies).toEqual([{ priority: 'P1' }, { isBlocked: true }]);
    });
  });

  it('reports a failed change with its message', async () => {
    const { result, report, backend } = setup();
    backend.failing.add('PATCH');

    act(() => {
      result.current.week.actions.onPriority(paint, 'P1');
    });

    await waitFor(() => {
      expect(report).toHaveBeenCalledWith('Não foi possível mudar a prioridade. Tente de novo.');
    });
  });

  it('moves a task and undoes the move, and ignores a move to the same state', async () => {
    const { result, backend } = setup();

    act(() => {
      result.current.week.actions.onMove(paint, 'to_do');
      result.current.week.actions.onMove(paint, 'done');
    });
    expect(await screen.findByText('Tarefa movida para Feito')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(backend.bodies).toEqual([{ status: 'done' }, { status: 'to_do' }]);
    });
  });

  it('says so when the move fails or its undo fails', async () => {
    const { result, backend, report } = setup();
    backend.failing.add('PATCH');

    act(() => {
      result.current.week.actions.onMove(paint, 'done');
    });
    await waitFor(() => {
      expect(report).toHaveBeenCalledWith('Não foi possível mover a tarefa. Tente de novo.');
    });

    backend.failing.delete('PATCH');
    act(() => {
      result.current.week.actions.onMove(paint, 'done');
    });
    await screen.findByText('Tarefa movida para Feito');
    backend.failing.add('PATCH');
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByText('Não foi possível desfazer. Tente de novo.')).toBeVisible();
  });

  it('archives, closing the open panel, and reopens it on undo', async () => {
    const { result, panel } = setup(paint.id);
    await waitFor(() => {
      expect(result.current.tasks.data).toBeDefined();
    });

    act(() => {
      result.current.week.actions.onArchive(paint);
    });
    await screen.findByText('Tarefa arquivada');
    expect(panel.close).toHaveBeenCalledWith(paint.id);

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(panel.reopen).toHaveBeenCalledWith(paint.id);
    });
  });

  it('deletes once even when asked twice, and reports a failure', async () => {
    const { result, backend, report } = setup();
    backend.failing.add('DELETE');

    act(() => {
      result.current.week.actions.onDelete(paint);
      result.current.week.actions.onDelete(paint);
    });

    await waitFor(() => {
      expect(report).toHaveBeenCalledWith('Não foi possível excluir a tarefa. Tente de novo.');
    });
    expect(report.mock.calls.filter(([message]) => message !== null)).toHaveLength(1);
  });

  it('says the undo failed when bringing the task back fails', async () => {
    const { result, backend } = setup();

    act(() => {
      result.current.week.actions.onDelete(paint);
    });
    await screen.findByText('Tarefa excluída');
    backend.failing.add('UNDO');
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText('Não foi possível desfazer. Tente de novo.')).toBeVisible();
  });

  it('asks the screen where focus goes around a move and a removal', async () => {
    const backend = serveTaskApi({ initiatives: [reforma], tasks: [paint] });
    const focus = {
      moved: vi.fn(),
      leaving: vi.fn(() => afterLeaving),
      restored: vi.fn(),
    };
    const afterLeaving = vi.fn();
    const panel = {
      openId: null,
      open: vi.fn(),
      close: vi.fn(),
      reopen: vi.fn(),
      selectPath: vi.fn(),
    };
    const { result } = renderHook(() => useTaskActions({ panel, report: vi.fn(), focus }), {
      wrapper: ({ children }: Readonly<{ children: ReactNode }>) => (
        <QueryClientProvider client={createQueryClient({ retry: false })}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      ),
    });

    act(() => {
      result.current.actions.onMove(paint, 'done');
    });
    await screen.findByText('Tarefa movida para Feito');
    expect(focus.moved).toHaveBeenCalledWith(paint, 'done');
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(focus.moved).toHaveBeenLastCalledWith(paint, 'to_do');
    });

    act(() => {
      result.current.actions.onDelete(paint);
    });
    await waitFor(() => {
      expect(afterLeaving).toHaveBeenCalledOnce();
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(focus.restored).toHaveBeenCalledWith(paint);
    });
    expect(backend.bodies).toEqual([{ status: 'done' }, { status: 'to_do' }]);
  });

  it('hands "Pôr na lista de hoje" to the caller', () => {
    const { result, addToToday } = setup();

    result.current.week.actions.onAddToToday?.(paint);

    expect(addToToday).toHaveBeenCalledWith(paint);
  });
});
