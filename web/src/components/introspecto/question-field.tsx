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
} from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './question-field.module.css';

export const ANSWER_IDLE_MS = 800;
const MAX_LENGTH = 10_000;

// Keepalive is for a page that is going away: the request has to outlive it.
export type Flush = (keepalive?: boolean) => Promise<boolean>;

interface QuestionFieldProps {
  name: string;
  prompt: string;
  // The answer the server confirmed.
  value: string;
  readOnly: boolean;
  // Still editable in the model but frozen while the sheet closes.
  locked: boolean;
  // Resolves true once the server confirmed the text; a false answer keeps the field dirty.
  onSave: (text: string, keepalive?: boolean) => Promise<boolean>;
  error: string | null;
  // The sheet asks every field to save what is pending before it closes.
  register: (name: string, flush: Flush | null) => void;
}

export function QuestionField({
  name,
  prompt,
  value,
  readOnly,
  locked,
  onSave,
  error,
  register,
}: Readonly<QuestionFieldProps>) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ draft, dirty, value, onSave });
  const sent = useRef<{ from: string; text: string } | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const fieldId = useId();
  const errorId = useId();

  useEffect(() => {
    latest.current = { draft, dirty, value, onSave };
  });

  // While the field is clean it follows an outside change of the saved text. The server stores the
  // trimmed text, so its echo of what was typed must not rewrite the draft: that would eat the
  // spaces and newlines typed after the pause. A save not yet confirmed keeps the field dirty.
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

  const flush = useCallback<Flush>((keepalive = false) => {
    clearTimeout(timer.current);
    const { draft: text, dirty: changed, value: saved, onSave: save } = latest.current;
    const next = text.trim();
    const pending = inflight.current ?? Promise.resolve(true);
    if (!changed || next === saved) return pending;
    // The blur and the unmount that follows it must not send the same text twice.
    if (sent.current?.from === saved && sent.current.text === next) return pending;
    sent.current = { from: saved, text: next };
    const request: Promise<boolean> = (keepalive ? save(next, true) : save(next)).then(
      (confirmed) => {
        if (inflight.current === request) inflight.current = null;
        if (sent.current?.text === next) sent.current = null;
        if (!confirmed) return confirmed;
        if (latest.current.draft.trim() === next) setDirty(false);
        return confirmed;
      },
    );
    inflight.current = request;
    return request;
  }, []);

  // A tab that closes, reloads or hides within the idle wait must not lose what was typed.
  useEffect(() => {
    function hide() {
      if (document.visibilityState === 'hidden') void flush(true);
    }
    function leave() {
      void flush(true);
    }
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [flush]);

  useEffect(() => {
    register(name, flush);
    return () => {
      register(name, null);
    };
  }, [name, register, flush]);

  // Switching week saves what is waiting, and tries once more what failed.
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, ANSWER_IDLE_MS);
  }

  function handleBlur() {
    void flush();
  }

  return (
    <div className={styles.question}>
      {readOnly ? (
        <div role="group" aria-labelledby={fieldId} className={styles.question}>
          <p id={fieldId} className={styles.prompt}>
            {prompt}
          </p>
          <p className={value === '' ? styles.empty : styles.read}>
            {value === '' ? 'Sem resposta.' : value}
          </p>
        </div>
      ) : (
        <>
          <label htmlFor={fieldId} className={styles.prompt}>
            {prompt}
          </label>
          <textarea
            id={fieldId}
            ref={field}
            className={styles.answer}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            rows={2}
            placeholder="Escreva com calma…"
            maxLength={MAX_LENGTH}
            readOnly={locked}
            value={draft}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </>
      )}
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon icon={CircleAlert} size={14} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
