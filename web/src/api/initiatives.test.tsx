import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { initiative, problemResponse } from '@/test/fixtures';
import { server } from '@/test/server';
import { ApiError } from './problem';
import {
  useArchiveInitiative,
  useCreateInitiative,
  useDeleteInitiative,
  useInitiatives,
  useRestoreInitiative,
  useUnarchiveInitiative,
  useUpdateInitiative,
} from './initiatives';

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  );
}

describe('useInitiatives', () => {
  it('loads the initiatives from GET /api/initiatives', async () => {
    server.use(http.get('*/api/initiatives', () => HttpResponse.json([initiative()])));

    const { result } = renderHook(() => useInitiatives(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([initiative()]);
    });
  });

  it('fails with an ApiError for a problem response', async () => {
    server.use(http.get('*/api/initiatives', () => problemResponse('internal', 500)));

    const { result } = renderHook(() => useInitiatives(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
    expect(result.current.error).toMatchObject({ status: 500, code: 'internal' });
  });
});

describe('useCreateInitiative', () => {
  it('posts the name, returns the created initiative and refreshes the list', async () => {
    const created = initiative({ id: '22222222-2222-4222-8222-222222222222', name: 'Horta' });
    const items = [initiative()];
    let body: unknown;
    server.use(
      http.get('*/api/initiatives', () => HttpResponse.json(items)),
      http.post('*/api/initiatives', async ({ request }) => {
        body = await request.json();
        items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const { result } = renderHook(
      () => ({ list: useInitiatives(), create: useCreateInitiative() }),
      {
        wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.create.mutateAsync('Horta');
    });

    expect(body).toEqual({ name: 'Horta' });
    expect(returned).toEqual(created);
    expect(result.current.list.data).toHaveLength(2);
  });

  it('rejects with the problem code on a 400', async () => {
    server.use(http.post('*/api/initiatives', () => problemResponse('initiative.name.blank')));

    const { result } = renderHook(() => useCreateInitiative(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('')).rejects.toMatchObject({
        status: 400,
        code: 'initiative.name.blank',
      });
    });
  });

  it('keeps the created initiative in the list when the refetch fails', async () => {
    const created = initiative({ id: '22222222-2222-4222-8222-222222222222', name: 'Horta' });
    let gets = 0;
    server.use(
      http.get('*/api/initiatives', () => {
        gets += 1;
        return gets === 1 ? HttpResponse.json([initiative()]) : problemResponse('internal', 500);
      }),
      http.post('*/api/initiatives', () => HttpResponse.json(created, { status: 201 })),
    );

    const { result } = renderHook(
      () => ({ list: useInitiatives(), create: useCreateInitiative() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(async () => {
      await result.current.create.mutateAsync('Horta');
    });

    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(result.current.list.data).toEqual([initiative(), created]);
  });

  it('does not duplicate an initiative the refetch already returned', async () => {
    const created = initiative({ id: '22222222-2222-4222-8222-222222222222', name: 'Horta' });
    const items = [initiative()];
    server.use(
      http.get('*/api/initiatives', () => HttpResponse.json(items)),
      http.post('*/api/initiatives', () => {
        if (!items.includes(created)) items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const { result } = renderHook(
      () => ({ list: useInitiatives(), create: useCreateInitiative() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    await act(async () => {
      await result.current.create.mutateAsync('Horta');
      await result.current.create.mutateAsync('Horta');
    });

    expect(result.current.list.data).toEqual([initiative(), created]);
  });
});

const HORTA_ID = '22222222-2222-4222-8222-222222222222';

function useAllHooks() {
  return {
    list: useInitiatives(),
    update: useUpdateInitiative(),
    archive: useArchiveInitiative(),
    unarchive: useUnarchiveInitiative(),
    remove: useDeleteInitiative(),
    restore: useRestoreInitiative(),
  };
}

async function loaded(items: unknown[]) {
  server.use(http.get('*/api/initiatives', () => HttpResponse.json(items)));
  const rendered = renderHook(useAllHooks, { wrapper });
  await waitFor(() => {
    expect(rendered.result.current.list.data).toHaveLength(items.length);
  });
  return rendered;
}

describe('useUpdateInitiative', () => {
  it('sends only the changed field as merge-patch JSON and updates the list', async () => {
    const items = [initiative(), initiative({ id: HORTA_ID, name: 'Horta' })];
    let contentType: string | null = null;
    let body: unknown;
    server.use(
      http.patch('*/api/initiatives/:id', async ({ request, params }) => {
        contentType = request.headers.get('content-type');
        body = await request.json();
        const updated = initiative({ id: String(params.id), name: 'Casa' });
        items[0] = updated;
        return HttpResponse.json(updated);
      }),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current.update.mutateAsync({
        id: items[0]?.id ?? '',
        changes: { name: 'Casa' },
      });
    });

    expect(contentType).toBe('application/merge-patch+json');
    expect(body).toEqual({ name: 'Casa' });
    expect(result.current.list.data?.map(({ name }) => name)).toEqual(['Casa', 'Horta']);
  });

  it('sends null to clear a field', async () => {
    let body: unknown;
    server.use(
      http.patch('*/api/initiatives/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(initiative());
      }),
    );
    const { result } = await loaded([initiative()]);

    await act(async () => {
      await result.current.update.mutateAsync({
        id: initiative().id,
        changes: { overallDeadline: null },
      });
    });

    expect(body).toEqual({ overallDeadline: null });
  });

  it('rejects with the problem code', async () => {
    server.use(
      http.patch('*/api/initiatives/:id', () => problemResponse('initiative.description.too-long')),
    );
    const { result } = await loaded([initiative()]);

    await act(async () => {
      await expect(
        result.current.update.mutateAsync({ id: initiative().id, changes: { description: 'x' } }),
      ).rejects.toMatchObject({ code: 'initiative.description.too-long' });
    });
  });
});

describe('archive, delete and their undo', () => {
  it.each([['archive'], ['remove']] as const)(
    '%s removes the initiative from the list',
    async (hook) => {
      const items = [initiative(), initiative({ id: HORTA_ID, name: 'Horta' })];
      server.use(
        http.post('*/api/initiatives/:id/archive', ({ params }) => {
          items.splice(0, items.length, ...items.filter(({ id }) => id !== params.id));
          return HttpResponse.json(initiative({ id: String(params.id) }));
        }),
        http.delete('*/api/initiatives/:id', ({ params }) => {
          items.splice(0, items.length, ...items.filter(({ id }) => id !== params.id));
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { result } = await loaded(items);

      await act(async () => {
        await result.current[hook].mutateAsync(initiative().id);
      });

      expect(result.current.list.data?.map(({ id }) => id)).toEqual([HORTA_ID]);
    },
  );

  it.each(['unarchive', 'restore'] as const)('%s brings the initiative back', async (hook) => {
    const items: ReturnType<typeof initiative>[] = [initiative()];
    const horta = initiative({ id: HORTA_ID, name: 'Horta' });
    const back = () => {
      items.push(horta);
      return HttpResponse.json(horta);
    };
    server.use(
      http.post('*/api/initiatives/:id/unarchive', back),
      http.post('*/api/initiatives/:id/restore', back),
    );
    const { result } = await loaded(items);

    await act(async () => {
      await result.current[hook].mutateAsync(HORTA_ID);
    });

    expect(result.current.list.data).toEqual([initiative(), horta]);
  });

  it('rejects with the 404 problem', async () => {
    server.use(http.post('*/api/initiatives/:id/archive', () => problemResponse('http.404', 404)));
    const { result } = await loaded([initiative()]);

    await act(async () => {
      await expect(result.current.archive.mutateAsync(initiative().id)).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});

describe('serial writes per initiative', () => {
  function gatedServer(log: string[], gate: Promise<void>) {
    server.use(
      http.patch('*/api/initiatives/:id', async ({ request, params }) => {
        const body = (await request.json()) as { name: string };
        log.push(`start ${body.name}`);
        if (body.name === 'A') await gate;
        log.push(`end ${body.name}`);
        return HttpResponse.json(initiative({ id: String(params.id), name: body.name }));
      }),
      http.post('*/api/initiatives/:id/archive', ({ params }) => {
        log.push('start archive');
        return HttpResponse.json(initiative({ id: String(params.id) }));
      }),
    );
  }

  it('sends two quick writes to one initiative in order, the second after the first settles', async () => {
    const log: string[] = [];
    let release!: () => void;
    gatedServer(
      log,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = await loaded([initiative()]);
    const id = initiative().id;

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    let third!: Promise<unknown>;
    act(() => {
      first = result.current.update.mutateAsync({ id, changes: { name: 'A' } });
      second = result.current.update.mutateAsync({ id, changes: { name: 'B' } });
      third = result.current.archive.mutateAsync(id);
    });
    await waitFor(() => {
      expect(log).toEqual(['start A']);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(log).toEqual(['start A']);

    release();
    await act(async () => {
      await Promise.all([first, second, third]);
    });

    expect(log).toEqual(['start A', 'end A', 'start B', 'end B', 'start archive']);
  });

  it('does not hold back writes to a different initiative', async () => {
    const log: string[] = [];
    let release!: () => void;
    gatedServer(
      log,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = await loaded([initiative(), initiative({ id: HORTA_ID, name: 'Horta' })]);

    let first!: Promise<unknown>;
    let other!: Promise<unknown>;
    act(() => {
      first = result.current.update.mutateAsync({
        id: initiative().id,
        changes: { name: 'A' },
      });
      other = result.current.update.mutateAsync({ id: HORTA_ID, changes: { name: 'B' } });
    });
    await act(async () => {
      await other;
    });

    expect(log).toEqual(['start A', 'start B', 'end B']);
    release();
    await act(async () => {
      await first;
    });
  });
});
