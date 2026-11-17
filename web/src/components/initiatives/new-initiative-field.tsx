'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { BLANK_NAME_MESSAGE, createInitiativeMessage } from '@/api/messages';
import { Icon } from '@/components/icon/icon';
import styles from './initiative-index.module.css';

const NAME_MAX_LENGTH = 200;

export function NewInitiativeField({
  onCreate,
}: Readonly<{ onCreate: (name: string) => Promise<void> }>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoreFocus = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const hintId = useId();

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      trigger.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);

  function close() {
    setOpen(false);
    setName('');
    setError(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError(BLANK_NAME_MESSAGE);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCreate(trimmed);
      close();
    } catch (failure) {
      setError(createInitiativeMessage(failure));
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (pending) return;
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape') {
      close();
      restoreFocus.current = true;
    }
  }

  if (!open) {
    return (
      <button
        ref={trigger}
        type="button"
        className={styles.new}
        onClick={() => {
          setOpen(true);
        }}
      >
        + Nova iniciativa
      </button>
    );
  }

  return (
    <div className={styles.field}>
      <input
        ref={input}
        className={error ? [styles.input, styles.inputError].join(' ') : styles.input}
        type="text"
        maxLength={NAME_MAX_LENGTH}
        placeholder="Nome da iniciativa"
        aria-label="Nome da nova iniciativa"
        aria-invalid={error ? true : undefined}
        aria-busy={pending ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        value={name}
        readOnly={pending}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!pending && name === '') close();
        }}
      />
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon icon={CircleAlert} size={14} />
          {error}
        </p>
      ) : null}
      <span id={hintId} className={styles.meta}>
        Enter cria · Esc cancela
      </span>
    </div>
  );
}
