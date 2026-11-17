'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
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
  cachedPhaseCount,
  useArchivePhase,
  useCreatePhase,
  useDeletePhase,
  usePhases,
  useRestorePhase,
  useUnarchivePhase,
  useUpdatePhase,
} from '@/api/phases';
import type { Phase } from '@/api/types';
import { useToast } from '@/components/toast/toast';
import { Loading } from '@/components/loading/loading';
import { InitiativeBoard } from './initiative-board';
import { InitiativeIndex, type FocusRequest } from './initiative-index';
import { InitiativePanel, type PanelIntent, type PanelRequest } from './initiative-panel';
import styles from './initiatives-screen.module.css';

const SELECTION_PARAM = 'iniciativa';
const DETAILS_PARAM = 'detalhes';
const PHASE_PARAM = 'fase';

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
  const counter = useRef(0);

  const clearRequest = useCallback(() => {
    setRequest(null);
  }, []);

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
    counter.current += 1;
    setRequest(intent === null ? null : { intent, id: counter.current, target: id });
    navigate((params) => {
      if (params.get(SELECTION_PARAM) !== id) params.delete(PHASE_PARAM);
      params.set(SELECTION_PARAM, id);
      params.set(DETAILS_PARAM, '1');
    });
  }

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
            });
          },
          () => {
            reportError(UNDO_FAILED_MESSAGE);
          },
        );
      },
    });
  }

  function archive(id: string) {
    const count = cachedPhaseCount(queryClient, id);
    return leave(id, archiveInitiative.mutateAsync, unarchiveInitiative.mutateAsync, {
      done: `Iniciativa arquivada${phaseCountSuffix(count)}`,
      failed: ARCHIVE_INITIATIVE_FAILED_MESSAGE,
    });
  }

  function remove(id: string) {
    return leave(id, deleteInitiative.mutateAsync, restoreInitiative.mutateAsync, {
      done: `Iniciativa excluída${phaseCountSuffix(cachedPhaseCount(queryClient, id))}`,
      failed: DELETE_INITIATIVE_FAILED_MESSAGE,
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

  const detailsOpen = selected !== null && searchParams.get(DETAILS_PARAM) === '1';
  const phases = phasesQuery.data;
  const filteredPhase = phases?.find(({ id }) => id === searchParams.get(PHASE_PARAM)) ?? null;

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
        phaseIndex={{
          phases,
          failed: phasesQuery.isError && !phases,
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
          onDelete: (phase) => {
            void leavePhase(phase, deletePhase.mutateAsync, restorePhase.mutateAsync, {
              done: 'Fase excluída',
              failed: DELETE_PHASE_FAILED_MESSAGE,
            });
          },
        }}
        actionError={actionError?.search === searchParams.toString() ? actionError.message : null}
        focusRequest={focusRequest}
      />
      <InitiativeBoard
        initiative={selected}
        phase={filteredPhase}
        detailsOpen={detailsOpen}
        onOpenDetails={() => {
          if (selected) openDetails(selected.id);
        }}
      />
      {selected && detailsOpen ? (
        <InitiativePanel
          initiative={selected}
          phases={phases}
          selectedPhaseId={filteredPhase?.id ?? null}
          onSelectPhase={selectPhase}
          onCreatePhase={(name) => createPhaseIn(selected.id, name)}
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
