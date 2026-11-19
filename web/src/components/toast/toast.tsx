'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { motion, useIsPresent } from 'motion/react';
import { createPortal } from 'react-dom';
import { useModalTarget } from '@/components/modal-host/modal-host';
import { Presence } from '@/components/motion/presence';
import { RISE, preset } from '@/components/motion/tokens';
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
  const present = useIsPresent();
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
    <motion.div
      className={styles.toast}
      inert={!present}
      {...preset(RISE)}
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
    </motion.div>
  );
}

interface ToastApi {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

function subscribeNever() {
  return () => undefined;
}

function createMount(): HTMLDivElement {
  const element = document.createElement('div');
  element.style.display = 'contents';
  return element;
}

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [current, setCurrent] = useState<(ToastOptions & { id: number }) | null>(null);
  const nextId = useRef(0);
  // Outside an aria-modal dialog "Desfazer" would be out of reach, so the region moves inside it.
  const host = useModalTarget();
  const slot = useRef<HTMLDivElement>(null);
  const created = useRef<HTMLDivElement | null>(null);
  // Null on the server and while hydrating, where the region renders in place.
  const mount = useSyncExternalStore(
    subscribeNever,
    () => (created.current ??= createMount()),
    () => null,
  );

  // One portal target moved between parents, so opening a modal does not remount the toast, which
  // would restart its timer and announce it again.
  useLayoutEffect(() => {
    const parent = host ?? slot.current;
    if (mount && parent && mount.parentNode !== parent) parent.append(mount);
  }, [mount, host]);

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
      <Presence>
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
      </Presence>
    </div>
  );

  return (
    <ToastContext value={api}>
      {children}
      <div ref={slot} style={{ display: 'contents' }} />
      {mount ? createPortal(region, mount) : region}
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a ToastProvider');
  return api;
}
