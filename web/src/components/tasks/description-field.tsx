'use client';

import { CircleAlert } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './task-panel.module.css';

export const DESCRIPTION_IDLE_MS = 800;
const MAX_LENGTH = 10_000;

interface DescriptionFieldProps {
  value: string;
  onSave: (text: string) => void;
  error?: string | null;
}

export function DescriptionField({ value, onSave, error }: Readonly<DescriptionFieldProps>) {
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ draft, value, onSave, error });
  const sent = useRef<{ from: string; text: string } | null>(null);
  const errorId = useId();

  useEffect(() => {
    latest.current = { draft, value, onSave, error };
  });

  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    if (element.scrollHeight > 0) element.style.height = `${String(element.scrollHeight)}px`;
  }, [draft]);

  // A failed save leaves the typed text in place, so the next blur tries again.
  useEffect(() => {
    if (error) sent.current = null;
  }, [error]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const { draft: text, value: saved, onSave: save } = latest.current;
    const next = text.trim();
    if (next === saved) return;
    // The blur and the unmount that follows it must not send the same text twice.
    if (sent.current?.from === saved && sent.current.text === next) return;
    sent.current = { from: saved, text: next };
    save(next);
  }, []);

  // Closing the panel or switching task must not lose text still waiting for the idle save,
  // but it does not retry a save that already failed.
  useEffect(
    () => () => {
      if (latest.current.error) clearTimeout(timer.current);
      else flush();
    },
    [flush],
  );

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DESCRIPTION_IDLE_MS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    clearTimeout(timer.current);
    setDraft(latest.current.value);
  }

  return (
    <div className={styles.descriptionWrapper}>
      <textarea
        ref={field}
        className={styles.description}
        aria-label="Descrição"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="Adicionar descrição"
        rows={3}
        maxLength={MAX_LENGTH}
        value={draft}
        onChange={handleChange}
        onBlur={flush}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon icon={CircleAlert} size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
