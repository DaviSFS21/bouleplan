import { ChevronRight, Check } from 'lucide-react';
import { useId, useState } from 'react';
import type { Initiative, Task } from '@/api/types';
import { Icon } from '@/components/icon/icon';
import { PrioritySelo } from '@/components/selo/selo';
import { deadlineLabel } from '@/components/tasks/task-deadline';
import { groupCounter, isPlanned, tallyText, trayCounter, type Plan } from './introspecto-model';
import styles from './week-plan.module.css';

interface WeekPlanProps {
  plan: Plan;
  initiatives: readonly Initiative[];
  nextWeek: string;
  now: Date;
  disabled: boolean;
  onToggle: (task: Task) => void;
}

interface RowProps {
  task: Task;
  checked: boolean;
  now: Date;
  disabled: boolean;
  onToggle: (task: Task) => void;
}

function effortText(task: Task): string {
  return task.estimatedEffort === null
    ? 'sem estimativa'
    : `${String(task.estimatedEffort).replace('.', ',')}h`;
}

// The whole row is the checkbox, so a click anywhere on it toggles and Space works natively.
function PlanRow({ task, checked, now, disabled, onToggle }: Readonly<RowProps>) {
  const titleId = useId();
  const metaId = useId();
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={titleId}
        aria-describedby={metaId}
        disabled={disabled}
        className={styles.item}
        onClick={() => {
          onToggle(task);
        }}
      >
        <span className={styles.box} aria-hidden="true">
          {checked ? <Icon icon={Check} size={14} /> : null}
        </span>
        <span className={styles.body}>
          <span id={titleId} className={styles.title}>
            {task.title}
          </span>
          <span id={metaId} className={styles.row}>
            <PrioritySelo priority={task.priority} />
            <span className={styles.meta}>{deadlineLabel(task.deadline, now, false).text}</span>
          </span>
        </span>
        <span
          className={
            task.estimatedEffort === null ? [styles.effort, styles.none].join(' ') : styles.effort
          }
        >
          {effortText(task)}
        </span>
      </button>
    </li>
  );
}

interface GroupProps {
  name: string;
  tasks: readonly Task[];
  nextWeek: string;
  now: Date;
  disabled: boolean;
  onToggle: (task: Task) => void;
}

function Group({ name, tasks, nextWeek, now, disabled, onToggle }: Readonly<GroupProps>) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className={styles.chevron} aria-hidden="true">
          <Icon icon={ChevronRight} size={14} />
        </span>
        <span className={styles.name}>{name}</span>
        <span className={[styles.meta, styles.counter].join(' ')}>
          {groupCounter(tasks, nextWeek)}
        </span>
      </button>
      <ul id={listId} hidden={!open} className={styles.items}>
        {tasks.map((task) => (
          <PlanRow
            key={task.id}
            task={task}
            checked={isPlanned(task, nextWeek)}
            now={now}
            disabled={disabled}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  );
}

export function WeekPlan({
  plan,
  initiatives,
  nextWeek,
  now,
  disabled,
  onToggle,
}: Readonly<WeekPlanProps>) {
  const trayId = useId();
  const names = new Map(initiatives.map(({ id, name }) => [id, name]));
  const shown = [...plan.behind, ...plan.groups.flatMap(({ tasks }) => tasks)];
  const tally = tallyText(shown.filter((task) => isPlanned(task, nextWeek)));
  return (
    <div className={styles.plan}>
      <div className={[styles.group, styles.tray].join(' ')}>
        <div className={styles.trayHead}>
          <h3 id={trayId} className={styles.overline}>
            Ficaram para trás
          </h3>
          <span className={[styles.meta, styles.counter].join(' ')}>
            {plan.behind.length > 0 ? trayCounter(plan.behind, nextWeek) : 'nada ficou'}
          </span>
        </div>
        <ul aria-labelledby={trayId} className={[styles.items, styles.flat].join(' ')}>
          {plan.behind.map((task) => (
            <PlanRow
              key={task.id}
              task={task}
              checked={isPlanned(task, nextWeek)}
              now={now}
              disabled={disabled}
              onToggle={onToggle}
            />
          ))}
        </ul>
      </div>
      <h3 className={[styles.overline, styles.separator].join(' ')}>A fazer, por iniciativa</h3>
      {plan.groups.length === 0 ? <p className={styles.empty}>Nenhuma tarefa a fazer.</p> : null}
      {plan.groups.map(({ initiativeId, tasks }) => (
        <Group
          key={initiativeId}
          name={names.get(initiativeId) ?? ''}
          tasks={tasks}
          nextWeek={nextWeek}
          now={now}
          disabled={disabled}
          onToggle={onToggle}
        />
      ))}
      <div className={styles.total} aria-live="polite">
        <span className={styles.overline}>Na semana</span>
        <span className={styles.value}>
          {tally.main}
          {tally.extra ? <span className={styles.meta}>{` ${tally.extra}`}</span> : null}
        </span>
      </div>
    </div>
  );
}
