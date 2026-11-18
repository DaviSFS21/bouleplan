import { Check } from 'lucide-react';
import { useId } from 'react';
import type { Task } from '@/api/types';
import { Icon } from '@/components/icon/icon';
import { PrioritySelo } from '@/components/selo/selo';
import { deadlineText } from './introspecto-model';
import styles from './week-summary.module.css';

interface WeekSummaryProps {
  done: readonly Task[];
  behind: readonly Task[];
  names: ReadonlyMap<string, string>;
  now: Date;
}

export function WeekSummary({ done, behind, names, now }: Readonly<WeekSummaryProps>) {
  const doneId = useId();
  const behindId = useId();
  return (
    <div className={styles.summary}>
      <div>
        <h3 id={doneId} className={styles.overline}>{`Concluídas · ${String(done.length)}`}</h3>
        <ul aria-labelledby={doneId} className={styles.list}>
          {done.map((task) => (
            <li key={task.id} className={styles.item}>
              <span className={[styles.icon, styles.done].join(' ')} aria-hidden="true">
                <Icon icon={Check} size={14} />
              </span>
              <span className={styles.body}>
                <span className={styles.title}>{task.title}</span>
                <span className={styles.meta}>{names.get(task.initiativeId)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 id={behindId} className={styles.overline}>
          {`Ficaram para trás · ${String(behind.length)}`}
        </h3>
        <ul aria-labelledby={behindId} className={styles.list}>
          {behind.map((task) => (
            <li key={task.id} className={styles.item}>
              <span className={[styles.icon, styles.left].join(' ')} aria-hidden="true" />
              <span className={styles.body}>
                <span className={styles.title}>{task.title}</span>
                <span className={styles.row}>
                  <PrioritySelo priority={task.priority} />
                  <span className={styles.meta}>
                    {`${names.get(task.initiativeId) ?? ''} · ${deadlineText(task.deadline, now)}`}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
