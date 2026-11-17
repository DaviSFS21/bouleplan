import { Lock } from 'lucide-react';
import { Icon } from '@/components/icon/icon';
import type { TaskPriority } from '@/api/types';
import styles from './selo.module.css';

type Tone = 'p1' | 'p2' | 'p3' | 'bloqueada';

const PRIORITY_TONE: Readonly<Record<TaskPriority, Tone>> = { P1: 'p1', P2: 'p2', P3: 'p3' };

export function seloClassName(priority: TaskPriority, mini = false): string {
  return [styles.selo, styles[PRIORITY_TONE[priority]], mini ? styles.mini : ''].join(' ').trim();
}

export function PrioritySelo({
  priority,
  mini = false,
}: Readonly<{ priority: TaskPriority; mini?: boolean }>) {
  return <span className={seloClassName(priority, mini)}>{priority}</span>;
}

export function BlockedSelo({ mini = false }: Readonly<{ mini?: boolean }>) {
  return (
    <span className={[styles.selo, styles.bloqueada, mini ? styles.mini : ''].join(' ').trim()}>
      <Icon icon={Lock} size={14} aria-hidden="true" />
      Bloqueada
    </span>
  );
}
