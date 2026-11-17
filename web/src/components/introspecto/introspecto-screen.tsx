'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useCloseIntrospection, useIntrospection, useSaveAnswer } from '@/api/introspection';
import { useInitiatives } from '@/api/initiatives';
import {
  CLOSE_UNSAVED_MESSAGE,
  LOAD_INTROSPECTION_FAILED_MESSAGE,
  introspectionMessage,
  updateTaskMessage,
} from '@/api/messages';
import { useTasks, useUpdateTask } from '@/api/tasks';
import type { AnswerKey, Initiative, Introspection, Task } from '@/api/types';
import { Icon } from '@/components/icon/icon';
import { formatDate } from '@/components/initiatives/initiative-dates';
import { WEEK_PARAM } from '@/components/initiatives/url-params';
import { Loading } from '@/components/loading/loading';
import { weekTitle } from '@/components/planner/planner-dates';
import { isoWeekNumber, stepWeek } from '@/components/tasks/task-week';
import { useClock } from '@/components/tasks/use-clock';
import { useToast } from '@/components/toast/toast';
import { buildPlan, leftBehind, planChange, rememberLeft, summarize } from './introspecto-model';
import { defaultReviewWeek, isWeekStart } from './introspecto-week';
import { QuestionField, type Flush } from './question-field';
import { WeekPlan } from './week-plan';
import { WeekSummary } from './week-summary';
import styles from './introspecto-screen.module.css';

const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function IntrospectoFallback() {
  return (
    <main className={styles.status}>
      <div role="status" aria-label="Carregando o Introspecto">
        <Loading />
      </div>
    </main>
  );
}

function metaText(sheet: Introspection, now: Date): string {
  if (sheet.closedAt) return `Fechada em ${formatDate(sheet.closedAt, now)}`;
  if (sheet.updatedAt) return `Rascunho salvo às ${TIME.format(new Date(sheet.updatedAt))}`;
  return 'Ainda não começada';
}

interface WeekNavigation {
  previous: string | null;
  next: string | null;
  goTo: (week: string | null) => void;
}

interface SheetProps {
  weekStart: string;
  sheet: Introspection;
  tasks: readonly Task[];
  initiatives: readonly Initiative[];
  now: Date;
  navigation: WeekNavigation;
}

function Sheet({ weekStart, sheet, tasks, initiatives, now, navigation }: Readonly<SheetProps>) {
  const toast = useToast();
  const saveAnswer = useSaveAnswer();
  const closeSheet = useCloseIntrospection();
  const updateTask = useUpdateTask();
  const flushes = useRef(new Map<string, Flush>());
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closed = sheet.closedAt !== null;
  const nextWeek = stepWeek(weekStart, 1);

  const names = useMemo(
    () => new Map(initiatives.map(({ id, name }) => [id, name])),
    [initiatives],
  );
  const [left, setLeft] = useState(() => rememberLeft(new Set(), tasks, weekStart));
  const remembered = rememberLeft(left, tasks, weekStart);
  if (remembered !== left) setLeft(remembered);
  const done = useMemo(() => summarize(tasks, weekStart).done, [tasks, weekStart]);
  const behind = useMemo(() => leftBehind(tasks, remembered), [tasks, remembered]);
  const plan = useMemo(
    () =>
      buildPlan(
        tasks,
        behind,
        initiatives.map(({ id }) => id),
      ),
    [tasks, behind, initiatives],
  );

  const register = useCallback((name: string, flush: Flush | null) => {
    if (flush) flushes.current.set(name, flush);
    else flushes.current.delete(name);
  }, []);

  async function save(key: string, answer: string): Promise<boolean> {
    setErrors((current) => ({ ...current, [key]: null }));
    try {
      // The server owns the questions; the contract lists the MVP keys.
      await saveAnswer.mutateAsync({ weekStart, key: key as AnswerKey, answer });
      return true;
    } catch (failure) {
      setErrors((current) => ({ ...current, [key]: introspectionMessage(failure, 'save') }));
      return false;
    }
  }

  async function close() {
    setClosing(true);
    setCloseError(null);
    const saved = await Promise.all([...flushes.current.values()].map((flush) => flush()));
    if (saved.includes(false)) {
      setCloseError(CLOSE_UNSAVED_MESSAGE);
      setClosing(false);
      return;
    }
    try {
      await closeSheet.mutateAsync(weekStart);
    } catch (failure) {
      setCloseError(introspectionMessage(failure, 'close'));
    } finally {
      setClosing(false);
    }
  }

  async function toggle(task: Task) {
    if (nextWeek === null) return;
    try {
      await updateTask.mutateAsync({ task, changes: planChange(task, nextWeek) });
    } catch (failure) {
      toast.show({ message: updateTaskMessage(failure, 'plannedWeekStart') });
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p
              className={styles.overline}
            >{`Introspecto · semana ${String(isoWeekNumber(weekStart))}`}</p>
            <h1 className={styles.title}>{weekTitle(weekStart)}</h1>
            <p className={styles.meta} aria-live="polite">
              {metaText(sheet, now)}
            </p>
          </div>
          <div className={styles.controls} role="group" aria-label="Navegar entre semanas">
            <button
              type="button"
              className={styles.step}
              aria-label="Semana anterior"
              disabled={navigation.previous === null}
              onClick={() => {
                navigation.goTo(navigation.previous);
              }}
            >
              <Icon icon={ChevronLeft} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.step}
              aria-label="Próxima semana"
              disabled={navigation.next === null}
              onClick={() => {
                navigation.goTo(navigation.next);
              }}
            >
              <Icon icon={ChevronRight} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section aria-labelledby="introspecto-past" className={styles.section}>
          <h2 id="introspecto-past" className={styles.sectionTitle}>
            A semana que passou
          </h2>
          <WeekSummary done={done} behind={behind} names={names} now={now} />
          {sheet.answers.map(({ key, prompt, answer }) => (
            <QuestionField
              key={key}
              name={key}
              prompt={prompt}
              value={answer}
              readOnly={closed}
              error={errors[key] ?? null}
              onSave={(text) => save(key, text)}
              register={register}
            />
          ))}
        </section>

        {nextWeek === null ? null : (
          <section aria-labelledby="introspecto-next" className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 id="introspecto-next" className={styles.sectionTitle}>
                A próxima semana
              </h2>
              <span className={styles.meta}>{weekTitle(nextWeek)}</span>
            </div>
            <WeekPlan
              plan={plan}
              initiatives={initiatives}
              nextWeek={nextWeek}
              now={now}
              disabled={closed}
              onToggle={(task) => {
                void toggle(task);
              }}
            />
          </section>
        )}

        <footer className={styles.footer}>
          {closed ? (
            <p className={styles.note}>Esta folha foi fechada e não muda mais.</p>
          ) : (
            <>
              <p className={styles.note}>
                Ao fechar, a folha vai para o histórico e não muda mais.
              </p>
              <button
                type="button"
                className={styles.primary}
                disabled={closing}
                onClick={() => {
                  void close();
                }}
              >
                Fechar o Introspecto
              </button>
            </>
          )}
          {closeError ? (
            <p role="alert" className={styles.error}>
              {closeError}
            </p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

export function IntrospectoScreen({ now }: Readonly<{ now?: Date }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clock = useClock(now);
  const defaultWeek = defaultReviewWeek(clock);
  const requested = searchParams.get(WEEK_PARAM);
  const weekStart = isWeekStart(requested) ? requested : defaultWeek;

  const initiativesQuery = useInitiatives();
  const tasksQuery = useTasks();
  const sheetQuery = useIntrospection(weekStart);

  const initiatives = initiativesQuery.data;
  const listed = useMemo(() => {
    const live = new Set(initiatives?.map(({ id }) => id));
    return (tasksQuery.data ?? []).filter((task) => live.has(task.initiativeId));
  }, [tasksQuery.data, initiatives]);

  if (!initiatives || !tasksQuery.data || !sheetQuery.data) {
    const failed =
      (initiativesQuery.isError && !initiatives) ||
      (tasksQuery.isError && !tasksQuery.data) ||
      (sheetQuery.isError && !sheetQuery.data);
    if (!failed) return <IntrospectoFallback />;
    return (
      <main className={styles.status}>
        <p role="alert" className={styles.message}>
          {LOAD_INTROSPECTION_FAILED_MESSAGE}
        </p>
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            void initiativesQuery.refetch();
            void tasksQuery.refetch();
            void sheetQuery.refetch();
          }}
        >
          Tentar de novo
        </button>
      </main>
    );
  }

  const navigation: WeekNavigation = {
    previous: stepWeek(weekStart, -1),
    next: weekStart < defaultWeek ? stepWeek(weekStart, 1) : null,
    goTo: (week) => {
      if (week === null) return;
      const params = new URLSearchParams(window.location.search);
      if (week === defaultWeek) params.delete(WEEK_PARAM);
      else params.set(WEEK_PARAM, week);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
  };

  return (
    <Sheet
      key={weekStart}
      weekStart={weekStart}
      sheet={sheetQuery.data}
      tasks={listed}
      initiatives={initiatives}
      now={clock}
      navigation={navigation}
    />
  );
}
