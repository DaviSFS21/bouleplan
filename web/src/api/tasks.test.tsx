import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { initiative, phase, problemResponse, task } from '@/test/fixtures';
import { server } from '@/test/server';
import {
  useArchiveInitiative,
  useDeleteInitiative,
  useRestoreInitiative,
  useUnarchiveInitiative,
} from './initiatives';
import { useArchivePhase, useDeletePhase, useRestorePhase, useUnarchivePhase } from './phases';
import { ApiError } from './problem';
import {
  compareTasks,
  tasksKey,
  useArchiveTask,
  useCreateTask,
  useDeleteTask,
  useRestoreTask,
  useTasks,
  useUnarchiveTask,
  useUpdateTask,
} from './tasks';

const INITIATIVE_ID = initiative().id;
const paint = task();
const sand = task({ id: 'a1a1a1a1-0000-4000-8000-000000000002', title: 'Lixar' });

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  );
}

function useAllHooks() {
  return {
    list: useTasks(),
    client: useQueryClient(),
    create: useCreateTask(),
    update: useUpdateTask(),
    archive: useArchiveTask(),
    unarchive: useUnarchiveTask(),
    remove: useDeleteTask(),
    restore: useRestoreTask(),
  };
}

async function loaded(items: ReturnType<typeof task>[]) {
  server.use(http.get('*/api/tasks', () => HttpResponse.json(items)));
  const rendered = renderHook(useAllHooks, { wrapper });
  await waitFor(() => {
    expect(rendered.result.current.list.data).toEqual(items);
  });
  return rendered;
}

describe('compareTasks', () => {
  const sorted = (items: ReturnType<typeof task>[]) =>
    [...items].sort(compareTasks).map((t) => t.id);

  it('orders by priority first', () => {
    const p1 = task({ id: 'b', priority: 'P1' });
    const p3 = task({ id: 'a', priority: 'P3' });
    expect(sorted([p3, paint, p1])).toEqual(['b', paint.id, 'a']);
  });

  it('orders by deadline with none last', () => {
    const none = task({ id: 'n' });
    const late = task({ id: 'l', deadline: '2026-12-01' });
    const soon = task({ id: 's', deadline: '2026-11-01' });
    expect(sorted([none, late, soon])).toEqual(['s', 'l', 'n']);
    expect(sorted([soon, none])).toEqual(['s', 'n']);
  });

  it('orders by creation and then by id', () => {
    const older = task({ id: 'z', createdAt: '2026-01-01T09:00:00-03:00' });
    const twinA = task({ id: 'a' });
    const twinB = task({ id: 'b' });
    expect(sorted([twinB, older, twinA])).toEqual(['z', 'a', 'b']);
    expect(compareTasks(twinA, twinA)).toBe(0);
  });
});

describe('useTasks', () => {
  it('uses one key and loads every task', async () => {
    expect(tasksKey).toEqual(['tasks']);
    await loaded([paint, sand]);
  });

  it('fails with an ApiError for a problem response', async () => {
    server.use(http.get('*/api/tasks', () => problemResponse('internal', 500)));
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });
});

describe('useCreateTask', () => {
  it('posts the body to the initiative and adds the task', async () => {
    const created = task({ id: 'c', title: 'Pintar' });
    const items = [paint];
    let body: unknown;
    let initiativeId: unknown;
    server.use(
      http.post('*/api/initiatives/:id/tasks', async ({ request, params }) => {
        body = await request.json();
        initiativeId = params.id;
        items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current.create.mutateAsync({
        initiativeId: INITIATIVE_ID,
        title: 'Pintar',
        status: 'done',
      });
    });

    expect(body).toEqual({ title: 'Pintar', status: 'done' });
    expect(initiativeId).toBe(INITIATIVE_ID);
    await waitFor(() => {
      expect(result.current.list.data).toEqual([paint, created]);
    });
  });

  it('rejects with the problem and leaves the list alone', async () => {
    server.use(http.post('*/api/initiatives/:id/tasks', () => problemResponse('task.title.blank')));
    const { result } = await loaded([paint]);

    await act(async () => {
      await expect(
        result.current.create.mutateAsync({
          initiativeId: INITIATIVE_ID,
          title: ' ',
          status: 'to_do',
        }),
      ).rejects.toMatchObject({ code: 'task.title.blank' });
    });

    await waitFor(() => {
      expect(result.current.list.data).toEqual([paint]);
    });
  });
});

describe('useUpdateTask', () => {
  it('patches as a merge patch and applies the change before the answer', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let patched: { body: unknown; type: string | null } | undefined;
    server.use(
      http.patch('*/api/tasks/:id', async ({ request }) => {
        await gate;
        patched = { body: await request.json(), type: request.headers.get('content-type') };
        return HttpResponse.json({ ...paint, priority: 'P1' });
      }),
    );
    const { result } = await loaded([paint, sand]);

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.update.mutateAsync({ task: paint, changes: { priority: 'P1' } });
    });

    await waitFor(() => {
      expect(result.current.list.data?.[0]?.priority).toBe('P1');
    });
    expect(patched).toBeUndefined();

    release();
    await act(async () => {
      await pending;
    });
    expect(patched).toEqual({
      body: { priority: 'P1' },
      type: 'application/merge-patch+json',
    });
    await waitFor(() => {
      expect(result.current.list.data?.[1]).toEqual(sand);
    });
  });

  it('rolls back only the changed fields when the request fails', async () => {
    server.use(http.patch('*/api/tasks/:id', () => problemResponse('internal', 500)));
    const { result } = await loaded([paint]);

    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          task: paint,
          changes: { status: 'done', isBlocked: true },
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => {
      expect(result.current.list.data).toEqual([paint]);
    });
  });

  it('keeps a field that a later change already owns', async () => {
    let calls = 0;
    const items = [paint];
    server.use(
      http.patch('*/api/tasks/:id', async () => {
        calls += 1;
        if (calls === 1) return problemResponse('internal', 500);
        await new Promise((resolve) => setTimeout(resolve, 40));
        items[0] = { ...paint, priority: 'P3' };
        return HttpResponse.json(items[0]);
      }),
    );
    const { result } = await loaded(items);

    await act(async () => {
      const first = result.current.update.mutateAsync({ task: paint, changes: { priority: 'P1' } });
      const second = result.current.update.mutateAsync({
        task: paint,
        changes: { priority: 'P3' },
      });
      await expect(first).rejects.toBeInstanceOf(ApiError);
      await second;
    });

    await waitFor(() => {
      expect(result.current.list.data?.[0]?.priority).toBe('P3');
    });
  });
});

describe('useArchiveTask and useDeleteTask', () => {
  it('removes the task at once and keeps it removed on success', async () => {
    const items = [paint, sand];
    server.use(
      http.post('*/api/tasks/:id/archive', () => {
        items.shift();
        return HttpResponse.json(paint);
      }),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current.archive.mutateAsync(paint);
    });

    await waitFor(() => {
      expect(result.current.list.data).toEqual([sand]);
    });
  });

  it('puts the task back when archiving fails', async () => {
    server.use(http.post('*/api/tasks/:id/archive', () => problemResponse('internal', 500)));
    const { result } = await loaded([paint, sand]);

    await act(async () => {
      await expect(result.current.archive.mutateAsync(paint)).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => {
      expect(result.current.list.data).toEqual(expect.arrayContaining([paint, sand]));
    });
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
  });

  it('deletes with a 204 and puts the task back when it fails', async () => {
    let fail = false;
    const items = [paint, sand];
    server.use(
      http.delete('*/api/tasks/:id', ({ params }) => {
        if (fail) return problemResponse('internal', 500);
        items.splice(
          items.findIndex(({ id }) => id === params.id),
          1,
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current.remove.mutateAsync(paint);
    });
    await waitFor(() => {
      expect(result.current.list.data).toEqual([sand]);
    });

    fail = true;
    await act(async () => {
      await expect(result.current.remove.mutateAsync(sand)).rejects.toBeInstanceOf(ApiError);
    });
    await waitFor(() => {
      expect(result.current.list.data).toEqual([sand]);
    });
  });
});

describe('useUnarchiveTask and useRestoreTask', () => {
  it('adds the returned task back without duplicating it', async () => {
    const items = [sand];
    const bringBack = () => {
      if (!items.includes(paint)) items.push(paint);
      return HttpResponse.json(paint);
    };
    server.use(
      http.post('*/api/tasks/:id/unarchive', bringBack),
      http.post('*/api/tasks/:id/restore', bringBack),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current.unarchive.mutateAsync(paint);
    });
    await act(async () => {
      await result.current.restore.mutateAsync(paint);
    });

    await waitFor(() => {
      expect(result.current.list.data?.filter(({ id }) => id === paint.id)).toHaveLength(1);
    });
  });
});

describe('hiding tasks with their phase or initiative', () => {
  function useHidingHooks() {
    return {
      list: useTasks(),
      archivePhase: useArchivePhase(),
      unarchivePhase: useUnarchivePhase(),
      deletePhase: useDeletePhase(),
      restorePhase: useRestorePhase(),
      archiveInitiative: useArchiveInitiative(),
      unarchiveInitiative: useUnarchiveInitiative(),
      deleteInitiative: useDeleteInitiative(),
      restoreInitiative: useRestoreInitiative(),
    };
  }

  it('loads the tasks again after every phase and initiative change', async () => {
    let loads = 0;
    const ok = () => HttpResponse.json(initiative());
    server.use(
      http.get('*/api/tasks', () => {
        loads += 1;
        return HttpResponse.json([paint]);
      }),
      http.post('*/api/phases/:id/archive', () => HttpResponse.json(phase())),
      http.post('*/api/phases/:id/unarchive', () => HttpResponse.json(phase())),
      http.post('*/api/phases/:id/restore', () => HttpResponse.json(phase())),
      http.delete('*/api/phases/:id', () => new HttpResponse(null, { status: 204 })),
      http.post('*/api/initiatives/:id/archive', ok),
      http.post('*/api/initiatives/:id/unarchive', ok),
      http.post('*/api/initiatives/:id/restore', ok),
      http.delete('*/api/initiatives/:id', () => new HttpResponse(null, { status: 204 })),
    );
    const { result } = renderHook(useHidingHooks, { wrapper });
    await waitFor(() => {
      expect(result.current.list.data).toEqual([paint]);
    });
    const chain = [
      () => result.current.archivePhase.mutateAsync(phase()),
      () => result.current.unarchivePhase.mutateAsync(phase()),
      () => result.current.deletePhase.mutateAsync(phase()),
      () => result.current.restorePhase.mutateAsync(phase()),
      () => result.current.archiveInitiative.mutateAsync(INITIATIVE_ID),
      () => result.current.unarchiveInitiative.mutateAsync(INITIATIVE_ID),
      () => result.current.deleteInitiative.mutateAsync(INITIATIVE_ID),
      () => result.current.restoreInitiative.mutateAsync(INITIATIVE_ID),
    ];

    for (const [position, run] of chain.entries()) {
      await act(async () => {
        await run();
      });
      await waitFor(() => {
        expect(loads).toBe(position + 2);
      });
    }
  });
});
