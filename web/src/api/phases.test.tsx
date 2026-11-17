import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { initiative, phase, problemResponse } from '@/test/fixtures';
import { server } from '@/test/server';
import { ApiError } from './problem';
import {
  fetchPhaseCount,
  phasesKey,
  useArchivePhase,
  useCreatePhase,
  useDeletePhase,
  usePhases,
  useRestorePhase,
  useUnarchivePhase,
  useUpdatePhase,
} from './phases';
import { useQueryClient } from '@tanstack/react-query';

const INITIATIVE_ID = initiative().id;
const demolition = phase();
const flooring = phase({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Piso',
  createdAt: '2026-01-02T10:00:00-03:00',
});

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  );
}

function useAllHooks() {
  return {
    list: usePhases(INITIATIVE_ID),
    client: useQueryClient(),
    create: useCreatePhase(),
    update: useUpdatePhase(),
    archive: useArchivePhase(),
    unarchive: useUnarchivePhase(),
    remove: useDeletePhase(),
    restore: useRestorePhase(),
  };
}

async function loaded(items: ReturnType<typeof phase>[]) {
  server.use(http.get('*/api/initiatives/:id/phases', () => HttpResponse.json(items)));
  const rendered = renderHook(useAllHooks, { wrapper });
  await waitFor(() => {
    expect(rendered.result.current.list.data).toEqual(items);
  });
  return rendered;
}

describe('usePhases', () => {
  it('uses the per-initiative key', () => {
    expect(phasesKey(INITIATIVE_ID)).toEqual(['initiatives', INITIATIVE_ID, 'phases']);
  });

  it('loads the phases of the initiative', async () => {
    await loaded([demolition]);
  });

  it('counts the phases fresh, even when they were never loaded', async () => {
    server.use(
      http.get('*/api/initiatives/:id/phases', () => HttpResponse.json([demolition, flooring])),
    );
    const { result } = renderHook(() => useQueryClient(), { wrapper });

    await expect(fetchPhaseCount(result.current, INITIATIVE_ID)).resolves.toBe(2);
  });

  it('counts 0 when the request fails', async () => {
    server.use(http.get('*/api/initiatives/:id/phases', () => problemResponse('internal', 500)));
    const { result } = renderHook(() => useQueryClient(), { wrapper });

    await expect(fetchPhaseCount(result.current, INITIATIVE_ID)).resolves.toBe(0);
  });

  it('counts 0 when the request is too slow', async () => {
    server.use(
      http.get('*/api/initiatives/:id/phases', async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json([demolition]);
      }),
    );
    const { result } = renderHook(() => useQueryClient(), { wrapper });

    await expect(fetchPhaseCount(result.current, INITIATIVE_ID, 20)).resolves.toBe(0);
  });

  it('does not fetch without an initiative id', async () => {
    const { result } = renderHook(() => usePhases(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fails with an ApiError for a problem response', async () => {
    server.use(http.get('*/api/initiatives/:id/phases', () => problemResponse('http.404', 404)));

    const { result } = renderHook(() => usePhases(INITIATIVE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });
});

describe('useCreatePhase', () => {
  it('posts the name, appends the phase and refreshes the list', async () => {
    const items = [demolition];
    let body: unknown;
    server.use(
      http.post('*/api/initiatives/:id/phases', async ({ request }) => {
        body = await request.json();
        items.push(flooring);
        return HttpResponse.json(flooring, { status: 201 });
      }),
    );
    const { result } = await loaded(items);

    let returned: unknown;
    await act(async () => {
      returned = await result.current.create.mutateAsync({
        initiativeId: INITIATIVE_ID,
        name: 'Piso',
      });
    });

    expect(body).toEqual({ name: 'Piso' });
    expect(returned).toEqual(flooring);
    expect(result.current.list.data).toEqual([demolition, flooring]);
  });

  it('keeps the created phase when the refetch fails and does not duplicate it', async () => {
    const { result } = await loaded([demolition]);
    server.use(
      http.post('*/api/initiatives/:id/phases', () => HttpResponse.json(flooring, { status: 201 })),
      http.get('*/api/initiatives/:id/phases', () => HttpResponse.json([demolition, flooring])),
    );

    await act(async () => {
      await result.current.create.mutateAsync({ initiativeId: INITIATIVE_ID, name: 'Piso' });
    });
    expect(result.current.list.data).toEqual([demolition, flooring]);

    server.use(
      http.post('*/api/initiatives/:id/phases', () => HttpResponse.json(flooring, { status: 201 })),
    );
    await act(async () => {
      await result.current.create.mutateAsync({ initiativeId: INITIATIVE_ID, name: 'Piso' });
    });
    expect(result.current.list.data).toHaveLength(2);
  });

  it('rejects with the problem code on a 400', async () => {
    const { result } = await loaded([demolition]);
    server.use(
      http.post('*/api/initiatives/:id/phases', () => problemResponse('phase.name.blank')),
    );

    await act(async () => {
      await expect(
        result.current.create.mutateAsync({ initiativeId: INITIATIVE_ID, name: ' ' }),
      ).rejects.toMatchObject({ code: 'phase.name.blank' });
    });
  });

  it('leaves an unloaded list alone', async () => {
    server.use(
      http.post('*/api/initiatives/:id/phases', () => HttpResponse.json(flooring, { status: 201 })),
    );
    const { result } = renderHook(() => ({ create: useCreatePhase(), client: useQueryClient() }), {
      wrapper,
    });

    await act(async () => {
      await result.current.create.mutateAsync({ initiativeId: INITIATIVE_ID, name: 'Piso' });
    });

    expect(result.current.client.getQueryData(phasesKey(INITIATIVE_ID))).toBeUndefined();
  });
});

describe('useUpdatePhase', () => {
  it('sends the name as merge-patch JSON and updates the list', async () => {
    let contentType: string | null = null;
    let body: unknown;
    server.use(
      http.patch('*/api/phases/:id', async ({ request, params }) => {
        contentType = request.headers.get('content-type');
        body = await request.json();
        return HttpResponse.json({ ...demolition, id: String(params.id), name: 'Obra' });
      }),
    );
    const { result } = await loaded([demolition, flooring]);
    server.use(
      http.get('*/api/initiatives/:id/phases', () =>
        HttpResponse.json([{ ...demolition, name: 'Obra' }, flooring]),
      ),
    );

    await act(async () => {
      await result.current.update.mutateAsync({ phase: demolition, name: 'Obra' });
    });

    expect(contentType).toBe('application/merge-patch+json');
    expect(body).toEqual({ name: 'Obra' });
    expect(result.current.list.data?.map(({ name }) => name)).toEqual(['Obra', 'Piso']);
  });

  it('rejects with the problem code', async () => {
    server.use(http.patch('*/api/phases/:id', () => problemResponse('phase.name.too-long')));
    const { result } = await loaded([demolition]);

    await act(async () => {
      await expect(
        result.current.update.mutateAsync({ phase: demolition, name: 'x' }),
      ).rejects.toMatchObject({ code: 'phase.name.too-long' });
    });
  });
});

describe('archive, delete and their undo', () => {
  it.each([['archive'], ['remove']] as const)(
    '%s removes the phase from the list',
    async (hook) => {
      server.use(
        http.post('*/api/phases/:id/archive', () => HttpResponse.json(demolition)),
        http.delete('*/api/phases/:id', () => new HttpResponse(null, { status: 204 })),
      );
      const { result } = await loaded([demolition, flooring]);
      server.use(http.get('*/api/initiatives/:id/phases', () => HttpResponse.json([flooring])));

      await act(async () => {
        await result.current[hook].mutateAsync(demolition);
      });

      expect(result.current.list.data).toEqual([flooring]);
    },
  );

  it.each(['unarchive', 'restore'] as const)(
    '%s brings the phase back in creation order',
    async (hook) => {
      server.use(
        http.post('*/api/phases/:id/unarchive', () => HttpResponse.json(demolition)),
        http.post('*/api/phases/:id/restore', () => HttpResponse.json(demolition)),
      );
      const { result } = await loaded([flooring]);
      server.use(
        http.get('*/api/initiatives/:id/phases', () => HttpResponse.json([demolition, flooring])),
      );

      await act(async () => {
        await result.current[hook].mutateAsync(demolition);
      });

      expect(result.current.list.data).toEqual([demolition, flooring]);
    },
  );

  it('rejects with the 404 problem', async () => {
    server.use(http.post('*/api/phases/:id/archive', () => problemResponse('http.404', 404)));
    const { result } = await loaded([demolition]);

    await act(async () => {
      await expect(result.current.archive.mutateAsync(demolition)).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});

describe('serial writes per phase', () => {
  it('sends two quick writes to one phase in order and does not hold back another phase', async () => {
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch('*/api/phases/:id', async ({ request, params }) => {
        const body = (await request.json()) as { name: string };
        log.push(`start ${body.name}`);
        if (body.name === 'A') await gate;
        log.push(`end ${body.name}`);
        return HttpResponse.json({ ...demolition, id: String(params.id), name: body.name });
      }),
    );
    const { result } = await loaded([demolition, flooring]);

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    let other!: Promise<unknown>;
    act(() => {
      first = result.current.update.mutateAsync({ phase: demolition, name: 'A' });
      second = result.current.update.mutateAsync({ phase: demolition, name: 'B' });
      other = result.current.update.mutateAsync({ phase: flooring, name: 'C' });
    });
    await act(async () => {
      await other;
    });
    expect(log).toEqual(['start A', 'start C', 'end C']);

    release();
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(log).toEqual(['start A', 'start C', 'end C', 'end A', 'start B', 'end B']);
  });

  it('serializes phase creation with the initiative scope', async () => {
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/api/initiatives/:id/phases', async ({ request }) => {
        const body = (await request.json()) as { name: string };
        log.push(`start ${body.name}`);
        if (body.name === 'A') await gate;
        return HttpResponse.json({ ...flooring, name: body.name }, { status: 201 });
      }),
    );
    const { result } = await loaded([demolition]);

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.create.mutateAsync({ initiativeId: INITIATIVE_ID, name: 'A' });
      second = result.current.create.mutateAsync({ initiativeId: INITIATIVE_ID, name: 'B' });
    });
    await waitFor(() => {
      expect(log).toEqual(['start A']);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(log).toEqual(['start A']);

    release();
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(log).toEqual(['start A', 'start B']);
  });
});
