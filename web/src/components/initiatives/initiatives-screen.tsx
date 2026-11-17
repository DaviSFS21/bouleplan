'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCreateInitiative, useInitiatives } from '@/api/initiatives';
import { Loading } from '@/components/loading/loading';
import { InitiativeBoard } from './initiative-board';
import { InitiativeIndex } from './initiative-index';
import styles from './initiatives-screen.module.css';

const SELECTION_PARAM = 'iniciativa';

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

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams);
    if (id === null) params.delete(SELECTION_PARAM);
    else params.set(SELECTION_PARAM, id);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
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

  return (
    <main className={styles.screen}>
      <InitiativeIndex
        initiatives={data}
        selectedId={selected?.id ?? null}
        onSelect={select}
        onCreate={create}
      />
      <InitiativeBoard initiative={selected} />
    </main>
  );
}
