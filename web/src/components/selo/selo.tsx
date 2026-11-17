import { Lock } from 'lucide-react';
import { Icon } from '@/components/icon/icon';
import type { TaskPriority } from '@/api/types';
import styles from './selo.module.css';

type Tone = 'p1' | 'p2' | 'p3' | 'bloqueada';

const PRIORITY_TONE: Readonly<Record<TaskPriority, Tone>> = { P1: 'p1', P2: 'p2', P3: 'p3' };

export function seloClassName(priority: TaskPriority): string {
  return [styles.selo, styles[PRIORITY_TONE[priority]]].join(' ');
}

export function PrioritySelo({ priority }: Readonly<{ priority: TaskPriority }>) {
  return <span className={seloClassName(priority)}>{priority}</span>;
}

export function BlockedSelo() {
  return (
    <span className={[styles.selo, styles.bloqueada].join(' ')}>
      <Icon icon={Lock} size={14} aria-hidden="true" />
      Bloqueada
    </span>
  );
}
