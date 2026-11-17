'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';
import styles from './toast.module.css';

export const TOAST_DURATION_MS = 6000;

export interface ToastOptions {
  message: string;
  onUndo: () => void;
}

interface UndoToastProps extends ToastOptions {
  onDismiss: () => void;
}

export function UndoToast({ message, onUndo, onDismiss }: Readonly<UndoToastProps>) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(TOAST_DURATION_MS);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      dismiss.current();
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }

  return (
    <div
      className={styles.toast}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={handleBlur}
    >
      <span>{message}</span>
      <button
        type="button"
        className={styles.undo}
        onClick={() => {
          onUndo();
          onDismiss();
        }}
      >
        Desfazer
      </button>
      <span className={styles.time} aria-hidden="true" />
    </div>
  );
}

interface ToastApi {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [current, setCurrent] = useState<(ToastOptions & { id: number }) | null>(null);
  const nextId = useRef(0);

  const api = useMemo<ToastApi>(
    () => ({
      show: (options) => {
        nextId.current += 1;
        setCurrent({ ...options, id: nextId.current });
      },
    }),
    [],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div role="status" className={styles.region}>
        {current ? (
          <UndoToast
            key={current.id}
            message={current.message}
            onUndo={current.onUndo}
            onDismiss={() => {
              setCurrent(null);
            }}
          />
        ) : null}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a ToastProvider');
  return api;
}
