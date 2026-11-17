import styles from './progress-bar.module.css';

interface ProgressBarProps {
  label: string;
  done: number;
  total: number;
}

export function ProgressBar({ label, done, total }: Readonly<ProgressBarProps>) {
  if (total === 0) return <span className={styles.text}>sem tarefas ainda</span>;
  return (
    <span className={styles.progress}>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className={styles.track}
      >
        <span className={styles.done} style={{ width: `${String((done / total) * 100)}%` }} />
      </span>
      <span className={styles.text}>{`${String(done)} de ${String(total)} feitas`}</span>
    </span>
  );
}
