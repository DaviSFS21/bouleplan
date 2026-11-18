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
  // Resolves true once the server confirmed the text; a false answer keeps the field dirty.
  onSave: (text: string) => Promise<boolean>;
  onRevert?: () => void;
  error?: string | null;
}

export function DescriptionField({
  value,
  onSave,
  onRevert,
  error,
}: Readonly<DescriptionFieldProps>) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ draft, dirty, value, onSave, error });
  const sent = useRef<{ from: string; text: string } | null>(null);
  const errorId = useId();

  useEffect(() => {
    latest.current = { draft, dirty, value, onSave, error };
  });

  // While the field is clean it follows the saved text. A save that is sent but not confirmed
  // keeps it dirty, because the optimistic value matches the draft and a rollback must not wipe it.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!dirty && value !== draft.trim()) setDraft(value);
  }

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
    const { draft: text, dirty: changed, value: saved, onSave: save } = latest.current;
    if (!changed) return;
    const next = text.trim();
    if (next === saved) return;
    // The blur and the unmount that follows it must not send the same text twice.
    if (sent.current?.from === saved && sent.current.text === next) return;
    sent.current = { from: saved, text: next };
    void save(next).then((confirmed) => {
      if (confirmed && latest.current.draft.trim() === next) setDirty(false);
    });
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
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DESCRIPTION_IDLE_MS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    const { draft: text, value: saved } = latest.current;
    // With nothing to revert, Esc is left to close the panel.
    if (text === saved) return;
    event.stopPropagation();
    clearTimeout(timer.current);
    sent.current = null;
    setDraft(saved);
    setDirty(false);
    onRevert?.();
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
