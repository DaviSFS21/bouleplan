import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './status-strip.module.css';

export type StatusTone = 'erro' | 'atencao' | 'sucesso' | 'info';

const ICONS: Readonly<Record<StatusTone, LucideIcon>> = {
  erro: CircleAlert,
  atencao: TriangleAlert,
  sucesso: CircleCheck,
  info: Info,
};

interface StatusStripProps {
  tone: StatusTone;
  title: string;
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  // False inside a live region of its own, which announces it instead.
  announce?: boolean;
}

export function StatusStrip({
  tone,
  title,
  children,
  action,
  announce = true,
}: Readonly<StatusStripProps>) {
  return (
    <div
      role={announce ? (tone === 'erro' ? 'alert' : 'status') : undefined}
      className={[styles.strip, styles[tone]].join(' ')}
    >
      <span className={styles.icon}>
        <Icon icon={ICONS[tone]} aria-hidden="true" />
      </span>
      <span className={styles.text}>
        <strong>{title}</strong> {children}
      </span>
      {action ? (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
