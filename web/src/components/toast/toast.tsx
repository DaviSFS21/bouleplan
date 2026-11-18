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
import { createPortal } from 'react-dom';
import { useModalTarget } from '@/components/modal-host/modal-host';
import styles from './toast.module.css';

export const TOAST_DURATION_MS = 6000;

export interface ToastOptions {
  message: string;
  // Without it the toast is only a notice: no button and no Ctrl+Z.
  onUndo?: () => void;
}

interface UndoToastProps extends ToastOptions {
  onDismiss: () => void;
}

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable)
  );
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

  const undo = useRef(onUndo);

  useEffect(() => {
    undo.current = onUndo;
  }, [onUndo]);

  const undoable = onUndo !== undefined;
  useEffect(() => {
    if (!undoable) return;
    function undoWithShortcut(event: KeyboardEvent) {
      const isUndo =
        (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
      if (!isUndo || isTextField(event.target)) return;
      event.preventDefault();
      undo.current?.();
      dismiss.current();
    }
    document.addEventListener('keydown', undoWithShortcut);
    return () => {
      document.removeEventListener('keydown', undoWithShortcut);
    };
  }, [undoable]);

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
      {onUndo ? (
        <>
          <span className={styles.hint}> (Ctrl+Z para desfazer)</span>
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
        </>
      ) : null}
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
  // Outside an aria-modal dialog "Desfazer" would be out of reach, so the region moves inside it.
  const host = useModalTarget();

  const api = useMemo<ToastApi>(
    () => ({
      show: (options) => {
        nextId.current += 1;
        setCurrent({ ...options, id: nextId.current });
      },
    }),
    [],
  );

  const region = (
    <div
      role="status"
      aria-label="Avisos"
      className={styles.region}
      data-hosted={host ? '' : undefined}
    >
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
  );

  return (
    <ToastContext value={api}>
      {children}
      {host ? createPortal(region, host) : region}
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a ToastProvider');
  return api;
}
