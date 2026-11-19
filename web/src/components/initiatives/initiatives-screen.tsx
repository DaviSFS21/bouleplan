'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  ARCHIVE_EPIC_FAILED_MESSAGE,
  BLANK_EPIC_NAME_MESSAGE,
  DELETE_INITIATIVE_FAILED_MESSAGE,
  DELETE_EPIC_FAILED_MESSAGE,
  UNDO_FAILED_MESSAGE,
  epicCountSuffix,
  renameEpicMessage,
} from '@/api/messages';
import {
  fetchEpicCount,
  useArchiveEpic,
  useCreateEpic,
  useDeleteEpic,
  useEpics,
  useRestoreEpic,
  useUnarchiveEpic,
  useUpdateEpic,
} from '@/api/epics';
import { useTasks } from '@/api/tasks';
import type { Epic } from '@/api/types';
import { useToast } from '@/components/toast/toast';
import { Drawer } from '@/components/drawer/drawer';
import { Loading } from '@/components/loading/loading';
import { useIsBelowDesktop } from '@/components/responsive/use-media-query';
import { InitiativeBoard } from './initiative-board';
import { InitiativeIndex, type FocusRequest } from './initiative-index';
import { InitiativePanel, type PanelIntent, type PanelRequest } from './initiative-panel';
import type { TaskPanelControl } from '@/components/tasks/task-board';
import {
  DETAILS_PARAM,
  EPIC_PARAM,
  LEGACY_EPIC_PARAM,
  SELECTION_PARAM,
  TASK_PARAM,
} from './url-params';
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
  const epicsQuery = useEpics(selectedInitiativeId);
  const createEpic = useCreateEpic();
  const updateEpic = useUpdateEpic();
  const archiveEpic = useArchiveEpic();
  const unarchiveEpic = useUnarchiveEpic();
  const deleteEpic = useDeleteEpic();
  const restoreEpic = useRestoreEpic();

  const toast = useToast();
  const archiveInitiative = useArchiveInitiative();
  const unarchiveInitiative = useUnarchiveInitiative();
  const deleteInitiative = useDeleteInitiative();
  const restoreInitiative = useRestoreInitiative();
  const [actionError, setActionError] = useState<{ message: string; search: string } | null>(null);
  const [request, setRequest] = useState<PanelRequest | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [newEpicRequest, setNewEpicRequest] = useState<{
    initiativeId: string;
    nonce: number;
  } | null>(null);
  const counter = useRef(0);
  const leaving = useRef(new Set<string>());
  const opener = useRef<HTMLButtonElement | null>(null);
  const drawerOpener = useRef<HTMLButtonElement | null>(null);
  const belowDesktop = useIsBelowDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [createSignal, setCreateSignal] = useState(0);

  // The drawer remounts the index on each open, so a spent signal would reopen the create field.
  if (belowDesktop && !drawerOpen && createSignal > 0) setCreateSignal(0);

  // Back at the desktop width the index is in place again, so a later narrow screen starts closed,
  // and focus, which was in the drawer, goes to the selected row.
  if (!belowDesktop && drawerOpen) {
    setDrawerOpen(false);
    setFocusRequest((current) => ({ id: selectedInitiativeId, nonce: (current?.nonce ?? 0) + 1 }));
  }

  const clearRequest = useCallback(() => {
    setRequest(null);
  }, []);

  const epicsFailed = epicsQuery.isError && !epicsQuery.data;

  // The epic section is not rendered while the epics are failed, so it cannot consume the intent.
  if (epicsFailed && newEpicRequest?.initiativeId === selectedInitiativeId) {
    setNewEpicRequest(null);
  }

  const clearNewEpicRequest = useCallback(() => {
    setNewEpicRequest(null);
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

  const legacyEpicParam = searchParams.get(LEGACY_EPIC_PARAM);

  useEffect(() => {
    if (legacyEpicParam === null) return;
    const params = new URLSearchParams(window.location.search);
    params.delete(LEGACY_EPIC_PARAM);
    if (!params.has(EPIC_PARAM)) params.set(EPIC_PARAM, legacyEpicParam);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [legacyEpicParam, router, pathname]);

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
    setNewEpicRequest(null);
    navigate((params) => {
      params.delete(EPIC_PARAM);
      if (id === null) {
        params.delete(SELECTION_PARAM);
        params.delete(DETAILS_PARAM);
      } else {
        params.set(SELECTION_PARAM, id);
      }
    });
  }

  function openDetails(id: string, intent: PanelIntent = null) {
    setNewEpicRequest(null);
    counter.current += 1;
    setRequest(intent === null ? null : { intent, id: counter.current, target: id });
    navigate((params) => {
      if (params.get(SELECTION_PARAM) !== id) params.delete(EPIC_PARAM);
      params.set(SELECTION_PARAM, id);
      params.set(DETAILS_PARAM, '1');
      params.delete(TASK_PARAM);
    });
  }

  function openTask(id: string) {
    const current = currentParams();
    if (current.get(TASK_PARAM) === id && !current.has(DETAILS_PARAM)) return;
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

  function selectTaskPath(initiativeId: string, epicId: string | null) {
    navigate((params) => {
      params.set(SELECTION_PARAM, initiativeId);
      if (epicId === null) params.delete(EPIC_PARAM);
      else params.set(EPIC_PARAM, epicId);
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
    const epicFilter = wasSelected ? currentParams().get(EPIC_PARAM) : null;
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
              if (epicFilter) params.set(EPIC_PARAM, epicFilter);
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
      const count = await fetchEpicCount(queryClient, id);
      await leave(id, archiveInitiative.mutateAsync, unarchiveInitiative.mutateAsync, {
        done: `Iniciativa arquivada${epicCountSuffix(count)}`,
        failed: ARCHIVE_INITIATIVE_FAILED_MESSAGE,
      });
    });
  }

  function remove(id: string) {
    return leaveOnce(id, async () => {
      const count = await fetchEpicCount(queryClient, id);
      await leave(id, deleteInitiative.mutateAsync, restoreInitiative.mutateAsync, {
        done: `Iniciativa excluída${epicCountSuffix(count)}`,
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
  const epics = epicsQuery.data;
  const filteredEpic =
    epics?.find(({ id }) => id === (searchParams.get(EPIC_PARAM) ?? legacyEpicParam)) ?? null;

  function newEpicIn(id: string) {
    navigate((params) => {
      if (params.get(SELECTION_PARAM) !== id) {
        params.delete(EPIC_PARAM);
        params.set(SELECTION_PARAM, id);
      }
    });
    counter.current += 1;
    setNewEpicRequest({ initiativeId: id, nonce: counter.current });
  }

  function selectEpic(id: string | null) {
    navigate((params) => {
      if (id === null) params.delete(EPIC_PARAM);
      else params.set(EPIC_PARAM, id);
    });
  }

  async function createEpicIn(initiativeId: string, name: string) {
    await createEpic.mutateAsync({ initiativeId, name });
  }

  async function renameEpic(epic: Epic, name: string) {
    if (name === '') {
      reportError(BLANK_EPIC_NAME_MESSAGE);
      return;
    }
    setActionError(null);
    try {
      await updateEpic.mutateAsync({ epic, name });
    } catch (failure) {
      reportError(renameEpicMessage(failure));
    }
  }

  async function leaveEpic(
    epic: Epic,
    action: (epic: Epic) => Promise<unknown>,
    undo: (epic: Epic) => Promise<unknown>,
    messages: { done: string; failed: string },
  ) {
    const list = epics ?? [];
    const position = list.findIndex(({ id }) => id === epic.id);
    const neighbour = list[position + 1] ?? list[position - 1];
    setActionError(null);
    try {
      await action(epic);
    } catch {
      reportError(messages.failed);
      return;
    }
    const wasFiltered = currentParams().get(EPIC_PARAM) === epic.id;
    if (wasFiltered) selectEpic(null);
    counter.current += 1;
    setFocusRequest({ id: epic.initiativeId, epicId: neighbour?.id, nonce: counter.current });
    toast.show({
      message: messages.done,
      onUndo: () => {
        undo(epic).then(
          () => {
            if (!wasFiltered) return;
            navigate((params) => {
              if (params.get(SELECTION_PARAM) === epic.initiativeId) {
                params.set(EPIC_PARAM, epic.id);
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

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const index = (
    <InitiativeIndex
      inDrawer={belowDesktop}
      createSignal={createSignal}
      initiatives={data}
      selectedId={selected?.id ?? null}
      onSelect={(id) => {
        closeDrawer();
        select(id);
      }}
      onCreate={create}
      onOpenDetails={(id) => {
        closeDrawer();
        openDetails(id);
      }}
      onEditName={(id) => {
        closeDrawer();
        openDetails(id, 'name');
      }}
      onEditColor={(id) => {
        closeDrawer();
        openDetails(id, 'color');
      }}
      onArchive={(id) => {
        void archive(id);
      }}
      onDelete={(id) => {
        void remove(id);
      }}
      onNewEpic={newEpicIn}
      epicIndex={{
        epics,
        failed: epicsFailed,
        selectedId: filteredEpic?.id ?? null,
        onSelect: (id) => {
          closeDrawer();
          selectEpic(id);
        },
        onCreate: (name) => createEpicIn(selected?.id ?? '', name),
        onRename: (epic, name) => {
          void renameEpic(epic, name);
        },
        onArchive: (epic) => {
          void leaveEpic(epic, archiveEpic.mutateAsync, unarchiveEpic.mutateAsync, {
            done: 'Épico arquivado',
            failed: ARCHIVE_EPIC_FAILED_MESSAGE,
          });
        },
        newEpicSignal:
          newEpicRequest?.initiativeId === selected?.id ? (newEpicRequest?.nonce ?? 0) : 0,
        onNewEpicHandled: clearNewEpicRequest,
        onDelete: (epic) => {
          void leaveEpic(epic, deleteEpic.mutateAsync, restoreEpic.mutateAsync, {
            done: 'Épico excluído',
            failed: DELETE_EPIC_FAILED_MESSAGE,
          });
        },
      }}
      actionError={actionError?.search === searchParams.toString() ? actionError.message : null}
      focusRequest={focusRequest}
      tasks={tasksQuery.data}
    />
  );

  let drawer: ReactNode = index;
  if (belowDesktop) {
    drawer = drawerOpen ? (
      <Drawer label="Gaveta de iniciativas" opener={drawerOpener} onClose={closeDrawer}>
        {index}
      </Drawer>
    ) : null;
  }

  return (
    <main className={styles.screen}>
      {drawer}
      <InitiativeBoard
        initiative={selected}
        epic={filteredEpic}
        detailsOpen={detailsOpen}
        openerRef={opener}
        initiatives={data}
        tasks={tasksQuery.data}
        tasksFailed={tasksQuery.isError}
        onRetryTasks={() => {
          void tasksQuery.refetch();
        }}
        taskPanel={taskPanel}
        drawerButton={
          belowDesktop
            ? {
                open: drawerOpen,
                onOpen: () => {
                  setDrawerOpen(true);
                },
              }
            : undefined
        }
        drawerOpenerRef={drawerOpener}
        onCreateInitiative={() => {
          setCreateSignal((signal) => signal + 1);
          setDrawerOpen(true);
        }}
        onOpenDetails={() => {
          if (selected) openDetails(selected.id);
        }}
      />
      {selected && detailsOpen ? (
        <InitiativePanel
          initiative={selected}
          epics={epics}
          tasks={tasksQuery.data}
          selectedEpicId={filteredEpic?.id ?? null}
          onSelectEpic={selectEpic}
          onCreateEpic={(name) => createEpicIn(selected.id, name)}
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
