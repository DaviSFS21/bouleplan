import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { initiative, epic, problemResponse, task } from '@/test/fixtures';
import { server } from '@/test/server';
import {
  useArchiveInitiative,
  useDeleteInitiative,
  useRestoreInitiative,
  useUnarchiveInitiative,
} from './initiatives';
import { useArchiveEpic, useDeleteEpic, useRestoreEpic, useUnarchiveEpic } from './epics';
import { ApiError } from './problem';
import {
  compareTasks,
  tasksKey,
  useAddBlocker,
  useArchiveTask,
  useCreateTask,
  useDeleteTask,
  useRemoveBlocker,
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
    addBlocker: useAddBlocker(),
    removeBlocker: useRemoveBlocker(),
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

describe('queued changes of one task', () => {
  it('keep their optimistic state when an earlier answer lands, without a refetch in between', async () => {
    const opened: (() => void)[] = [];
    let answered = 0;
    let lists = 0;
    let stored = paint;
    server.use(
      http.get('*/api/tasks', () => {
        lists += 1;
        return HttpResponse.json([stored]);
      }),
      http.patch('*/api/tasks/:id', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        await new Promise<void>((resolve) => opened.push(resolve));
        answered += 1;
        stored = { ...stored, ...body };
        return HttpResponse.json({
          ...paint,
          ...body,
          updatedAt: `2026-03-0${String(answered)}T10:00:00-03:00`,
        });
      }),
    );
    const { result } = renderHook(useAllHooks, { wrapper });
    await waitFor(() => {
      expect(result.current.list.data).toEqual([paint]);
    });

    let both: Promise<unknown> = Promise.resolve();
    act(() => {
      both = Promise.all([
        result.current.update.mutateAsync({ task: paint, changes: { priority: 'P1' } }),
        result.current.update.mutateAsync({ task: paint, changes: { isBlocked: true } }),
      ]);
    });
    await waitFor(() => {
      expect(result.current.list.data?.[0]).toMatchObject({ priority: 'P1', isBlocked: true });
    });

    await waitFor(() => {
      expect(opened).toHaveLength(1);
    });
    opened[0]?.();
    await waitFor(() => {
      expect(opened).toHaveLength(2);
    });

    expect(result.current.list.data?.[0]).toMatchObject({ priority: 'P1', isBlocked: true });
    expect(lists).toBe(1);

    opened[1]?.();
    await act(async () => {
      await both;
    });
    await waitFor(() => {
      expect(lists).toBe(2);
    });
    expect(result.current.list.data?.[0]).toMatchObject({ priority: 'P1', isBlocked: true });
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

describe('hiding tasks with their epic or initiative', () => {
  function useHidingHooks() {
    return {
      list: useTasks(),
      archiveEpic: useArchiveEpic(),
      unarchiveEpic: useUnarchiveEpic(),
      deleteEpic: useDeleteEpic(),
      restoreEpic: useRestoreEpic(),
      archiveInitiative: useArchiveInitiative(),
      unarchiveInitiative: useUnarchiveInitiative(),
      deleteInitiative: useDeleteInitiative(),
      restoreInitiative: useRestoreInitiative(),
    };
  }

  it('loads the tasks again after every epic and initiative change', async () => {
    let loads = 0;
    const ok = () => HttpResponse.json(initiative());
    server.use(
      http.get('*/api/tasks', () => {
        loads += 1;
        return HttpResponse.json([paint]);
      }),
      http.post('*/api/epics/:id/archive', () => HttpResponse.json(epic())),
      http.post('*/api/epics/:id/unarchive', () => HttpResponse.json(epic())),
      http.post('*/api/epics/:id/restore', () => HttpResponse.json(epic())),
      http.delete('*/api/epics/:id', () => new HttpResponse(null, { status: 204 })),
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
      () => result.current.archiveEpic.mutateAsync(epic()),
      () => result.current.unarchiveEpic.mutateAsync(epic()),
      () => result.current.deleteEpic.mutateAsync(epic()),
      () => result.current.restoreEpic.mutateAsync(epic()),
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

describe('blockers', () => {
  const blocked = task({ id: 'b', title: 'Pintar' });
  const blocking = task({ id: 'a', title: 'Lixar', blocks: ['b'] });

  it('puts the relation on both tasks before the answer and refreshes the list', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    let lists = 0;
    server.use(
      http.get('*/api/tasks', () => {
        lists += 1;
        return HttpResponse.json([task({ id: 'a' }), task({ id: 'b' })]);
      }),
      http.put('*/api/tasks/:blockingId/blocks/:blockedId', async ({ params }) => {
        await gate;
        calls.push(`PUT ${String(params.blockingId)} ${String(params.blockedId)}`);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHook(useAllHooks, { wrapper });
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.addBlocker.mutateAsync({ blockingId: 'a', blockedId: 'b' });
    });
    await waitFor(() => {
      expect(result.current.list.data?.find(({ id }) => id === 'a')?.blocks).toEqual(['b']);
    });
    expect(result.current.list.data?.find(({ id }) => id === 'b')?.blockedBy).toEqual(['a']);

    release();
    await act(async () => {
      await pending;
    });
    expect(calls).toEqual(['PUT a b']);
    await waitFor(() => {
      expect(lists).toBe(2);
    });
  });

  it('takes the relation off both tasks with DELETE', async () => {
    const calls: string[] = [];
    const items = [blocking, { ...blocked, blockedBy: ['a'] }];
    const { result } = await loaded(items);
    server.use(
      http.delete('*/api/tasks/:blockingId/blocks/:blockedId', ({ params }) => {
        calls.push(`DELETE ${String(params.blockingId)} ${String(params.blockedId)}`);
        items.splice(0, 2, { ...blocking, blocks: [] }, { ...blocked, blockedBy: [] });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await act(async () => {
      await result.current.removeBlocker.mutateAsync({ blockingId: 'a', blockedId: 'b' });
    });

    expect(calls).toEqual(['DELETE a b']);
    expect(result.current.list.data?.[0]?.blocks).toEqual([]);
    expect(result.current.list.data?.[1]?.blockedBy).toEqual([]);
  });

  it('rolls the relation back and rejects with the problem code', async () => {
    server.use(
      http.put('*/api/tasks/:blockingId/blocks/:blockedId', () =>
        problemResponse('task.blocker.cycle', 422),
      ),
    );
    const { result } = await loaded([task({ id: 'a' }), task({ id: 'b' })]);

    await act(async () => {
      await expect(
        result.current.addBlocker.mutateAsync({ blockingId: 'a', blockedId: 'b' }),
      ).rejects.toMatchObject({ code: 'task.blocker.cycle' });
    });

    expect(result.current.list.data?.[0]?.blocks).toEqual([]);
    expect(result.current.list.data?.[1]?.blockedBy).toEqual([]);
  });

  it('does not repeat a relation that is already on screen', async () => {
    server.use(
      http.put(
        '*/api/tasks/:blockingId/blocks/:blockedId',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { result } = await loaded([blocking, { ...blocked, blockedBy: ['a'] }]);

    await act(async () => {
      await result.current.addBlocker.mutateAsync({ blockingId: 'a', blockedId: 'b' });
    });

    expect(result.current.list.data?.[0]?.blocks).toEqual(['b']);
    expect(result.current.list.data?.[1]?.blockedBy).toEqual(['a']);
  });
});

describe('useUpdateTask with the panel fields', () => {
  it('sends the epic and the planned week and keeps the server answer for them', async () => {
    const bodies: unknown[] = [];
    const items = [paint];
    server.use(
      http.patch('*/api/tasks/:id', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        items[0] = { ...paint, ...body, epicId: 'new-implicit' };
        return HttpResponse.json(items[0]);
      }),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current.update.mutateAsync({
        task: paint,
        changes: { epicId: null, plannedWeekStart: '2026-11-16' },
      });
    });

    expect(bodies).toEqual([{ epicId: null, plannedWeekStart: '2026-11-16' }]);
    expect(result.current.list.data?.[0]).toMatchObject({
      epicId: 'new-implicit',
      plannedWeekStart: '2026-11-16',
    });
  });
});
