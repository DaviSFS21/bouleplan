'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  DELETE_INITIATIVE_FAILED_MESSAGE,
  UNDO_FAILED_MESSAGE,
} from '@/api/messages';
import { useToast } from '@/components/toast/toast';
import { Loading } from '@/components/loading/loading';
import { InitiativeBoard } from './initiative-board';
import { InitiativeIndex, type FocusRequest } from './initiative-index';
import { InitiativePanel, type PanelIntent, type PanelRequest } from './initiative-panel';
import styles from './initiatives-screen.module.css';

const SELECTION_PARAM = 'iniciativa';
const DETAILS_PARAM = 'detalhes';

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
    return leave(id, archiveInitiative.mutateAsync, unarchiveInitiative.mutateAsync, {
      done: 'Iniciativa arquivada',
      failed: ARCHIVE_INITIATIVE_FAILED_MESSAGE,
    });
  }

  function remove(id: string) {
    return leave(id, deleteInitiative.mutateAsync, restoreInitiative.mutateAsync, {
      done: 'Iniciativa excluída',
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

  const requestedId = searchParams.get(SELECTION_PARAM);
  const selected = data.find((initiative) => initiative.id === requestedId) ?? null;

  const detailsOpen = selected !== null && searchParams.get(DETAILS_PARAM) === '1';

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
        actionError={actionError?.search === searchParams.toString() ? actionError.message : null}
        focusRequest={focusRequest}
      />
      <InitiativeBoard
        initiative={selected}
        detailsOpen={detailsOpen}
        onOpenDetails={() => {
          if (selected) openDetails(selected.id);
        }}
      />
      {selected && detailsOpen ? (
        <InitiativePanel
          initiative={selected}
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
