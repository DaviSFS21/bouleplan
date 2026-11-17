'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useArchiveInitiative,
  useCreateInitiative,
  useDeleteInitiative,
  useInitiatives,
  useRestoreInitiative,
  useUnarchiveInitiative,
} from '@/api/initiatives';
import {
  ARCHIVE_INITIATIVE_FAILED_MESSAGE,
  ARCHIVE_PHASE_FAILED_MESSAGE,
  BLANK_PHASE_NAME_MESSAGE,
  DELETE_INITIATIVE_FAILED_MESSAGE,
  DELETE_PHASE_FAILED_MESSAGE,
  UNDO_FAILED_MESSAGE,
  phaseCountSuffix,
  renamePhaseMessage,
} from '@/api/messages';
import {
  fetchPhaseCount,
  useArchivePhase,
  useCreatePhase,
  useDeletePhase,
  usePhases,
  useRestorePhase,
  useUnarchivePhase,
  useUpdatePhase,
} from '@/api/phases';
import { useTasks } from '@/api/tasks';
import type { Phase } from '@/api/types';
import { useToast } from '@/components/toast/toast';
import { Loading } from '@/components/loading/loading';
import { InitiativeBoard } from './initiative-board';
import { InitiativeIndex, type FocusRequest } from './initiative-index';
import { InitiativePanel, type PanelIntent, type PanelRequest } from './initiative-panel';
import type { TaskPanelControl } from '@/components/tasks/task-board';
import { DETAILS_PARAM, PHASE_PARAM, SELECTION_PARAM, TASK_PARAM } from './url-params';
import styles from './initiatives-screen.module.css';

export function InitiativesFallback() {
  return (
    <main className={styles.status}>
      <div role="status" aria-label="Carregando iniciativas">
        <Loading />
      </div>
    </main>
  );
}

export function InitiativesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isError, isFetching, refetch } = useInitiatives();
  const createInitiative = useCreateInitiative();
  const queryClient = useQueryClient();
  const requestedId = searchParams.get(SELECTION_PARAM);
  const selectedInitiativeId = data?.some(({ id }) => id === requestedId) ? requestedId : null;
  const tasksQuery = useTasks();
  const taskParam = searchParams.get(TASK_PARAM);
  const taskWriting = useIsMutating({
    predicate: (mutation) => mutation.options.scope?.id.startsWith('task-') === true,
  });
  const liveInitiatives = new Set(data?.map(({ id }) => id));
  const knownTask = tasksQuery.data?.find(
    ({ id, initiativeId }) => id === taskParam && liveInitiatives.has(initiativeId),
  );
  const openTaskId = knownTask?.id ?? null;
  const phasesQuery = usePhases(selectedInitiativeId);
  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const archivePhase = useArchivePhase();
  const unarchivePhase = useUnarchivePhase();
  const deletePhase = useDeletePhase();
  const restorePhase = useRestorePhase();

  const toast = useToast();
  const archiveInitiative = useArchiveInitiative();
  const unarchiveInitiative = useUnarchiveInitiative();
  const deleteInitiative = useDeleteInitiative();
  const restoreInitiative = useRestoreInitiative();
  const [actionError, setActionError] = useState<{ message: string; search: string } | null>(null);
  const [request, setRequest] = useState<PanelRequest | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [newPhaseRequest, setNewPhaseRequest] = useState<{
    initiativeId: string;
    nonce: number;
  } | null>(null);
  const counter = useRef(0);
  const leaving = useRef(new Set<string>());
  const opener = useRef<HTMLButtonElement | null>(null);

  const clearRequest = useCallback(() => {
    setRequest(null);
  }, []);

  const phasesFailed = phasesQuery.isError && !phasesQuery.data;

  // The phase section is not rendered while the phases are failed, so it cannot consume the intent.
  if (phasesFailed && newPhaseRequest?.initiativeId === selectedInitiativeId) {
    setNewPhaseRequest(null);
  }

  const clearNewPhaseRequest = useCallback(() => {
    setNewPhaseRequest(null);
  }, []);

  const settled = data !== undefined && tasksQuery.data !== undefined && !tasksQuery.isFetching;
  const dropTaskParam = taskParam !== null && openTaskId === null && settled && taskWriting === 0;

  // An unknown, hidden or removed task leaves no panel and no stale link.
  useEffect(() => {
    if (!dropTaskParam) return;
    const params = new URLSearchParams(window.location.search);
    params.delete(TASK_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [dropTaskParam, router, pathname]);

  function currentParams() {
    return new URLSearchParams(window.location.search);
  }

  function reportError(message: string) {
    setActionError({ message, search: currentParams().toString() });
  }

  function navigate(change: (params: URLSearchParams) => void) {
    const params = currentParams();
    change(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function select(id: string | null) {
    setNewPhaseRequest(null);
    navigate((params) => {
      params.delete(PHASE_PARAM);
      if (id === null) {
        params.delete(SELECTION_PARAM);
        params.delete(DETAILS_PARAM);
      } else {
        params.set(SELECTION_PARAM, id);
      }
    });
  }

  function openDetails(id: string, intent: PanelIntent = null) {
    setNewPhaseRequest(null);
    counter.current += 1;
    setRequest(intent === null ? null : { intent, id: counter.current, target: id });
    navigate((params) => {
      if (params.get(SELECTION_PARAM) !== id) params.delete(PHASE_PARAM);
      params.set(SELECTION_PARAM, id);
      params.set(DETAILS_PARAM, '1');
      params.delete(TASK_PARAM);
    });
  }

  function openTask(id: string) {
    navigate((params) => {
      params.set(TASK_PARAM, id);
      params.delete(DETAILS_PARAM);
    });
  }

  function closeTask(id?: string) {
    if (id !== undefined && currentParams().get(TASK_PARAM) !== id) return;
    navigate((params) => {
      params.delete(TASK_PARAM);
    });
  }

  function reopenTask(id: string) {
    const params = currentParams();
    if (params.has(TASK_PARAM) || params.get(DETAILS_PARAM) === '1') return;
    openTask(id);
  }

  function selectTaskPath(initiativeId: string, phaseId: string | null) {
    navigate((params) => {
      params.set(SELECTION_PARAM, initiativeId);
      if (phaseId === null) params.delete(PHASE_PARAM);
      else params.set(PHASE_PARAM, phaseId);
    });
  }

  const taskPanel: TaskPanelControl = {
    openId: openTaskId,
    open: openTask,
    close: closeTask,
    reopen: reopenTask,
    selectPath: selectTaskPath,
  };

  function closeDetails() {
    navigate((params) => {
      params.delete(DETAILS_PARAM);
    });
  }

  async function leave(
    id: string,
    action: (id: string) => Promise<unknown>,
    undo: (id: string) => Promise<unknown>,
    messages: { done: string; failed: string },
  ) {
    const list = data ?? [];
    const position = list.findIndex((item) => item.id === id);
    const neighbour = list[position + 1] ?? list[position - 1];
    setActionError(null);
    try {
      await action(id);
    } catch {
      reportError(messages.failed);
      return;
    }
    const wasSelected = currentParams().get(SELECTION_PARAM) === id;
    const phaseFilter = wasSelected ? currentParams().get(PHASE_PARAM) : null;
    if (wasSelected) select(null);
    counter.current += 1;
    setFocusRequest({ id: neighbour?.id ?? null, nonce: counter.current });
    toast.show({
      message: messages.done,
      onUndo: () => {
        undo(id).then(
          () => {
            if (!wasSelected) return;
            navigate((params) => {
              params.set(SELECTION_PARAM, id);
              params.delete(DETAILS_PARAM);
              if (phaseFilter) params.set(PHASE_PARAM, phaseFilter);
            });
          },
          () => {
            reportError(UNDO_FAILED_MESSAGE);
          },
        );
      },
    });
  }

  async function leaveOnce(id: string, run: () => Promise<void>) {
    if (leaving.current.has(id)) return;
    leaving.current.add(id);
    try {
      await run();
    } finally {
      leaving.current.delete(id);
    }
  }

  function archive(id: string) {
    return leaveOnce(id, async () => {
      const count = await fetchPhaseCount(queryClient, id);
      await leave(id, archiveInitiative.mutateAsync, unarchiveInitiative.mutateAsync, {
        done: `Iniciativa arquivada${phaseCountSuffix(count)}`,
        failed: ARCHIVE_INITIATIVE_FAILED_MESSAGE,
      });
    });
  }

  function remove(id: string) {
    return leaveOnce(id, async () => {
      const count = await fetchPhaseCount(queryClient, id);
      await leave(id, deleteInitiative.mutateAsync, restoreInitiative.mutateAsync, {
        done: `Iniciativa excluída${phaseCountSuffix(count)}`,
        failed: DELETE_INITIATIVE_FAILED_MESSAGE,
      });
    });
  }

  async function create(name: string): Promise<string> {
    const created = await createInitiative.mutateAsync(name);
    select(created.id);
    return created.id;
  }

  if (!data) {
    if (!isError || isFetching) return <InitiativesFallback />;
    return (
      <main className={styles.status}>
        <p role="alert" className={styles.message}>
          Não foi possível carregar as iniciativas.
        </p>
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            void refetch();
          }}
        >
          Tentar de novo
        </button>
      </main>
    );
  }

  const selected = data.find((initiative) => initiative.id === requestedId) ?? null;

  const detailsOpen =
    selected !== null && searchParams.get(DETAILS_PARAM) === '1' && openTaskId === null;
  const phases = phasesQuery.data;
  const filteredPhase = phases?.find(({ id }) => id === searchParams.get(PHASE_PARAM)) ?? null;

  function newPhaseIn(id: string) {
    navigate((params) => {
      if (params.get(SELECTION_PARAM) !== id) {
        params.delete(PHASE_PARAM);
        params.set(SELECTION_PARAM, id);
      }
    });
    counter.current += 1;
    setNewPhaseRequest({ initiativeId: id, nonce: counter.current });
  }

  function selectPhase(id: string | null) {
    navigate((params) => {
      if (id === null) params.delete(PHASE_PARAM);
      else params.set(PHASE_PARAM, id);
    });
  }

  async function createPhaseIn(initiativeId: string, name: string) {
    await createPhase.mutateAsync({ initiativeId, name });
  }

  async function renamePhase(phase: Phase, name: string) {
    if (name === '') {
      reportError(BLANK_PHASE_NAME_MESSAGE);
      return;
    }
    setActionError(null);
    try {
      await updatePhase.mutateAsync({ phase, name });
    } catch (failure) {
      reportError(renamePhaseMessage(failure));
    }
  }

  async function leavePhase(
    phase: Phase,
    action: (phase: Phase) => Promise<unknown>,
    undo: (phase: Phase) => Promise<unknown>,
    messages: { done: string; failed: string },
  ) {
    const list = phases ?? [];
    const position = list.findIndex(({ id }) => id === phase.id);
    const neighbour = list[position + 1] ?? list[position - 1];
    setActionError(null);
    try {
      await action(phase);
    } catch {
      reportError(messages.failed);
      return;
    }
    const wasFiltered = currentParams().get(PHASE_PARAM) === phase.id;
    if (wasFiltered) selectPhase(null);
    counter.current += 1;
    setFocusRequest({ id: phase.initiativeId, phaseId: neighbour?.id, nonce: counter.current });
    toast.show({
      message: messages.done,
      onUndo: () => {
        undo(phase).then(
          () => {
            if (!wasFiltered) return;
            navigate((params) => {
              if (params.get(SELECTION_PARAM) === phase.initiativeId) {
                params.set(PHASE_PARAM, phase.id);
              }
            });
          },
          () => {
            reportError(UNDO_FAILED_MESSAGE);
          },
        );
      },
    });
  }

  return (
    <main className={styles.screen}>
      <InitiativeIndex
        initiatives={data}
        selectedId={selected?.id ?? null}
        onSelect={select}
        onCreate={create}
        onOpenDetails={(id) => {
          openDetails(id);
        }}
        onEditName={(id) => {
          openDetails(id, 'name');
        }}
        onEditColor={(id) => {
          openDetails(id, 'color');
        }}
        onArchive={(id) => {
          void archive(id);
        }}
        onDelete={(id) => {
          void remove(id);
        }}
        onNewPhase={newPhaseIn}
        phaseIndex={{
          phases,
          failed: phasesFailed,
          selectedId: filteredPhase?.id ?? null,
          onSelect: selectPhase,
          onCreate: (name) => createPhaseIn(selected?.id ?? '', name),
          onRename: (phase, name) => {
            void renamePhase(phase, name);
          },
          onArchive: (phase) => {
            void leavePhase(phase, archivePhase.mutateAsync, unarchivePhase.mutateAsync, {
              done: 'Fase arquivada',
              failed: ARCHIVE_PHASE_FAILED_MESSAGE,
            });
          },
          newPhaseSignal:
            newPhaseRequest?.initiativeId === selected?.id ? (newPhaseRequest?.nonce ?? 0) : 0,
          onNewPhaseHandled: clearNewPhaseRequest,
          onDelete: (phase) => {
            void leavePhase(phase, deletePhase.mutateAsync, restorePhase.mutateAsync, {
              done: 'Fase excluída',
              failed: DELETE_PHASE_FAILED_MESSAGE,
            });
          },
        }}
        actionError={actionError?.search === searchParams.toString() ? actionError.message : null}
        focusRequest={focusRequest}
        tasks={tasksQuery.data}
      />
      <InitiativeBoard
        initiative={selected}
        phase={filteredPhase}
        detailsOpen={detailsOpen}
        openerRef={opener}
        initiatives={data}
        tasks={tasksQuery.data}
        tasksFailed={tasksQuery.isError}
        onRetryTasks={() => {
          void tasksQuery.refetch();
        }}
        taskPanel={taskPanel}
        onOpenDetails={() => {
          if (selected) openDetails(selected.id);
        }}
      />
      {selected && detailsOpen ? (
        <InitiativePanel
          initiative={selected}
          phases={phases}
          tasks={tasksQuery.data}
          selectedPhaseId={filteredPhase?.id ?? null}
          onSelectPhase={selectPhase}
          onCreatePhase={(name) => createPhaseIn(selected.id, name)}
          opener={opener}
          fallbackFocus={() =>
            document.querySelector<HTMLElement>(`[data-initiative-id="${selected.id}"]`)
          }
          request={request}
          onRequestHandled={clearRequest}
          onClose={closeDetails}
          onArchive={() => {
            void archive(selected.id);
          }}
          onDelete={() => {
            void remove(selected.id);
          }}
          onSaved={() => {
            setActionError(null);
          }}
          onSaveFailed={reportError}
        />
      ) : null}
    </main>
  );
}
