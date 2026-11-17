'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { usePhases } from '@/api/phases';
import {
  INVALID_EFFORT_MESSAGE,
  BLANK_TASK_TITLE_MESSAGE,
  updateTaskMessage,
  type TaskField,
} from '@/api/messages';
import { useAddBlocker, useRemoveBlocker, useUpdateTask } from '@/api/tasks';
import type { Task, TaskChanges, TaskStatus } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { DeadlineField, localToday } from '@/components/deadline-field/deadline-field';
import { Icon } from '@/components/icon/icon';
import { InlineText } from '@/components/inline-text/inline-text';
import { formatDate, formatElapsed } from '@/components/initiatives/initiative-dates';
import { phaseLabel } from '@/components/initiatives/phase-label';
import { PHASE_PARAM, SELECTION_PARAM } from '@/components/initiatives/url-params';
import { BlockedSelo } from '@/components/selo/selo';
import { SidePanel } from '@/components/side-panel/side-panel';
import { useToast } from '@/components/toast/toast';
import { BlockerList } from './blocker-list';
import { DescriptionField } from './description-field';
import { PriorityField } from './priority-field';
import { ReservedTime } from './reserved-time';
import { deadlineLabel } from './task-deadline';
import { formatEffort, parseEffort } from './task-effort';
import { STATUSES, statusTitle } from './task-filter';
import { taskMenuItems, type TaskActions } from './task-menu';
import { useIsCurrent } from './use-is-current';
import { useMinuteClock } from './use-minute-clock';
import { WeekField } from './week-field';
import styles from './task-panel.module.css';

const TITLE_MAX_LENGTH = 300;

interface TaskPanelProps {
  task: Task;
  // Visible tasks: the lists show their titles and the combobox offers them.
  tasks: readonly Task[];
  initiativeNames: ReadonlyMap<string, string>;
  actions: TaskActions;
  onOpenTask: (id: string) => void;
  focusSignal: number;
  onSelectPath: (initiativeId: string, phaseId: string | null) => void;
  fallbackFocus: () => HTMLElement | null;
  now?: Date;
}

type Errors = Partial<Record<TaskField, string>>;

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{children}</div>
    </>
  );
}

export function TaskPanel({
  task,
  tasks,
  initiativeNames,
  actions,
  onOpenTask,
  focusSignal,
  onSelectPath,
  fallbackFocus,
  now,
}: Readonly<TaskPanelProps>) {
  const toast = useToast();
  const update = useUpdateTask();
  const addBlocker = useAddBlocker();
  const removeBlocker = useRemoveBlocker();
  const phasesQuery = usePhases(task.initiativeId);
  const phases = phasesQuery.data;
  const clock = useMinuteClock(now);
  const [errors, setErrors] = useState<Errors>({});
  const [boundId, setBoundId] = useState(task.id);
  const [titleFocus, setTitleFocus] = useState(0);
  const [resets, setResets] = useState({ title: 0, estimatedEffort: 0 });
  const isCurrent = useIsCurrent(task.id);

  if (boundId !== task.id) {
    setBoundId(task.id);
    setErrors({});
    setResets({ title: 0, estimatedEffort: 0 });
    setTitleFocus(0);
  }

  async function save(field: TaskField, changes: TaskChanges): Promise<boolean> {
    const id = task.id;
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      await update.mutateAsync({ task, changes });
      return true;
    } catch (failure) {
      const message = updateTaskMessage(failure, field);
      if (isCurrent(id)) {
        setErrors((current) => ({ ...current, [field]: message }));
        // A rollback that lands before the field saw the new value would leave the typed text.
        if (field === 'title' || field === 'estimatedEffort') {
          setResets((current) => ({ ...current, [field]: current[field] + 1 }));
        }
      } else {
        toast.show({ message });
      }
      return false;
    }
  }

  const phase = phases?.find(({ id }) => id === task.phaseId);
  const phasePosition = phases?.findIndex(({ id }) => id === task.phaseId) ?? -1;
  const phaseText = phase ? phaseLabel(phasePosition, phase.name) : null;
  const initiativeName = initiativeNames.get(task.initiativeId) ?? '';
  const deadline = deadlineLabel(task.deadline, clock, task.status === 'done');

  const path = (
    <>
      <a
        href={`?${SELECTION_PARAM}=${task.initiativeId}`}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onSelectPath(task.initiativeId, null);
        }}
      >
        {initiativeName}
      </a>
      {phase && phaseText ? (
        <>
          {' › '}
          <a
            href={`?${SELECTION_PARAM}=${task.initiativeId}&${PHASE_PARAM}=${phase.id}`}
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              onSelectPath(task.initiativeId, phase.id);
            }}
          >
            {phaseText}
          </a>
        </>
      ) : null}
    </>
  );

  const menu = (
    <ActionMenu
      label="Ações da tarefa"
      items={taskMenuItems(task, actions, {
        withOpen: false,
        onEditTitle: () => {
          setTitleFocus((signal) => signal + 1);
        },
      })}
    />
  );

  const statusMenu = (
    <ActionMenu
      label={`Estado: ${statusTitle(task.status)}`}
      trigger={{
        className: styles.valueButton ?? '',
        children: (
          <>
            {statusTitle(task.status)}
            <Icon icon={ChevronDown} size={14} aria-hidden="true" />
          </>
        ),
      }}
      items={[
        {
          group: 'Estado',
          items: STATUSES.map((status: TaskStatus) => ({
            label: statusTitle(status),
            checked: task.status === status,
            onSelect: () => {
              if (task.status !== status) void save('status', { status });
            },
          })),
        },
        { separator: true },
        {
          label: task.isBlocked ? 'Desbloquear' : 'Marcar como bloqueada',
          onSelect: () => {
            void save('isBlocked', { isBlocked: !task.isBlocked });
          },
        },
      ]}
    />
  );

  const phaseMenu = (
    <ActionMenu
      label={`Fase: ${phaseText ?? (task.phaseId === null ? 'Sem fase' : 'Carregando')}`}
      trigger={{
        className: styles.valueButton ?? '',
        children: (
          <>
            {phaseText ?? (task.phaseId === null ? 'Sem fase' : 'Carregando…')}
            <Icon icon={ChevronDown} size={14} aria-hidden="true" />
          </>
        ),
      }}
      items={[
        {
          group: 'Fase',
          items: [
            { name: 'Sem fase', target: null },
            ...(phases ?? []).map((item, position) => ({
              name: phaseLabel(position, item.name),
              target: item.id,
            })),
          ].map(({ name, target }) => ({
            label: name,
            checked: task.phaseId === target,
            onSelect: () => {
              if (task.phaseId !== target) void save('phaseId', { phaseId: target });
            },
          })),
        },
      ]}
    />
  );

  function commitEffort(text: string) {
    const parsed = parseEffort(text);
    if (!parsed.valid) return;
    if (parsed.hours === task.estimatedEffort) {
      setResets((current) => ({ ...current, estimatedEffort: current.estimatedEffort + 1 }));
      return;
    }
    void save('estimatedEffort', { estimatedEffort: parsed.hours });
  }

  function relation(field: 'blocks' | 'blockedBy', other: string) {
    return field === 'blocks'
      ? { blockingId: task.id, blockedId: other }
      : { blockingId: other, blockedId: task.id };
  }

  const footer = `Criada em ${formatDate(task.createdAt, clock)} · alterada ${formatElapsed(task.updatedAt, clock)} · salva automaticamente`;

  function errorLine(field: TaskField) {
    const message = errors[field];
    return message ? (
      <p role="alert" className={styles.error}>
        {message}
      </p>
    ) : null;
  }

  return (
    <SidePanel
      label="Tarefa"
      eyebrow={path}
      eyebrowStyle="path"
      actions={menu}
      footer={footer}
      fallbackFocus={fallbackFocus}
      preferFallback
      focusSignal={focusSignal}
      onClose={actions.onClose}
    >
      <InlineText
        key={`title-${task.id}-${String(resets.title)}`}
        label="Título da tarefa"
        variant="title"
        value={task.title}
        maxLength={TITLE_MAX_LENGTH}
        focusSignal={titleFocus}
        trim
        error={errors.title}
        validate={(text) => (text === '' ? BLANK_TASK_TITLE_MESSAGE : null)}
        onCommit={(title) => {
          void save('title', { title });
        }}
      />
      <div className={styles.props}>
        <Row label="Estado">
          <span className={styles.stateRow}>
            {statusMenu}
            {task.isBlocked ? <BlockedSelo /> : null}
          </span>
        </Row>
        {errorLine('status') ?? errorLine('isBlocked')}
        <Row label="Prioridade">
          <PriorityField
            value={task.priority}
            onChange={(priority) => {
              if (priority !== task.priority) void save('priority', { priority });
            }}
          />
        </Row>
        {errorLine('priority')}
        <Row label="Fase">{phaseMenu}</Row>
        {errorLine('phaseId')}
        <Row label="Prazo">
          <DeadlineField
            key={`deadline-${task.id}`}
            label="Prazo"
            value={task.deadline}
            today={localToday(clock)}
            display={deadline}
            onChange={(next) => {
              void save('deadline', { deadline: next });
            }}
          />
        </Row>
        {errorLine('deadline')}
        <Row label="Esforço">
          <InlineText
            key={`effort-${task.id}-${String(resets.estimatedEffort)}`}
            label="Esforço"
            value={formatEffort(task.estimatedEffort)}
            placeholder="Definir"
            maxLength={10}
            trim
            error={errors.estimatedEffort}
            validate={(text) => (parseEffort(text).valid ? null : INVALID_EFFORT_MESSAGE)}
            onCommit={commitEffort}
          />
        </Row>
        <Row label="Semana">
          <WeekField
            value={task.plannedWeekStart}
            now={clock}
            onChange={(plannedWeekStart) => {
              void save('plannedWeekStart', { plannedWeekStart });
            }}
          />
        </Row>
        {errorLine('plannedWeekStart')}
        <Row label="Bloqueia">
          <BlockerList
            key={`blocks-${task.id}`}
            label="Bloqueia"
            addLabel="Buscar tarefa para bloquear"
            ids={task.blocks}
            tasks={tasks}
            selfId={task.id}
            exclude={task.blockedBy}
            hintOf={(other) => initiativeNames.get(other.initiativeId) ?? ''}
            onOpen={onOpenTask}
            onAdd={(other) => addBlocker.mutateAsync(relation('blocks', other))}
            onRemove={(other) => removeBlocker.mutateAsync(relation('blocks', other))}
          />
        </Row>
        <Row label="Bloqueada por">
          <BlockerList
            key={`blocked-by-${task.id}`}
            label="Bloqueada por"
            addLabel="Buscar tarefa bloqueadora"
            ids={task.blockedBy}
            tasks={tasks}
            selfId={task.id}
            exclude={task.blocks}
            hintOf={(other) => initiativeNames.get(other.initiativeId) ?? ''}
            onOpen={onOpenTask}
            onAdd={(other) => addBlocker.mutateAsync(relation('blockedBy', other))}
            onRemove={(other) => removeBlocker.mutateAsync(relation('blockedBy', other))}
          />
        </Row>
      </div>
      <section className={styles.section}>
        <h2 className={styles.eyebrow}>Descrição</h2>
        <DescriptionField
          key={`description-${task.id}`}
          value={task.description ?? ''}
          error={errors.description}
          onRevert={() => {
            setErrors((current) => ({ ...current, description: undefined }));
          }}
          onSave={(text) => save('description', { description: text === '' ? null : text })}
        />
      </section>
      <section className={styles.section}>
        <h2 className={styles.eyebrow}>Tempo dedicado</h2>
        <ReservedTime key={task.id} task={task} />
      </section>
    </SidePanel>
  );
}
