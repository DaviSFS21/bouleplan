import styles from './loading.module.css';

export function Loading({ size = 40 }: Readonly<{ size?: number }>) {
  return (
    <svg
      className={styles.loading}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      role="img"
      aria-label="Carregando"
    >
      <g className={styles.ring}>
        <circle
          className={styles.ink}
          cx="12"
          cy="8.05"
          r="6"
          strokeWidth="2.7"
          strokeDasharray="29.87 7.83"
          strokeDashoffset="3.92"
          transform="rotate(-90 12 8.05)"
        />
      </g>
      <line className={styles.track} x1="5.8" y1="18.55" x2="7.8" y2="18.55" strokeWidth="2.3" />
      <line className={styles.track} x1="11.9" y1="18.55" x2="18.2" y2="18.55" strokeWidth="2.3" />
      <line className={styles.track} x1="5.8" y1="22.15" x2="18.2" y2="22.15" strokeWidth="2.3" />
      <line
        className={[styles.ink, styles.fill, styles.fillA].join(' ')}
        pathLength="1"
        x1="5.8"
        y1="18.55"
        x2="7.8"
        y2="18.55"
        strokeWidth="2.3"
      />
      <line
        className={[styles.ink, styles.fill, styles.fillB].join(' ')}
        pathLength="1"
        x1="11.9"
        y1="18.55"
        x2="18.2"
        y2="18.55"
        strokeWidth="2.3"
      />
      <line
        className={[styles.ink, styles.fill, styles.fillC].join(' ')}
        pathLength="1"
        x1="5.8"
        y1="22.15"
        x2="18.2"
        y2="22.15"
        strokeWidth="2.3"
      />
    </svg>
  );
}
