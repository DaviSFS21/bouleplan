'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ApiError } from '@/api/problem';
import { Icon } from '@/components/icon/icon';
import styles from './initiative-index.module.css';

const FALLBACK_ERROR = 'Não foi possível criar a iniciativa. Tente de novo.';

export function NewInitiativeField({
  onCreate,
}: Readonly<{ onCreate: (name: string) => Promise<void> }>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (open && !pending) input.current?.focus();
  }, [open, pending]);

  function close() {
    setOpen(false);
    setName('');
    setError(null);
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await onCreate(name.trim());
      close();
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 400 ? failure.detail : FALLBACK_ERROR,
      );
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape') {
      close();
    }
  }

  if (!open) {
    return (
      <button
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
        placeholder="Nome da iniciativa"
        aria-label="Nome da nova iniciativa"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={name}
        disabled={pending}
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
      <span className={styles.meta}>Enter cria · Esc cancela</span>
    </div>
  );
}
