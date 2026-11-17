'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './quick-create-field.module.css';

const NAME_MAX_LENGTH = 200;

interface QuickCreateFieldProps {
  triggerLabel: string;
  inputLabel: string;
  placeholder: string;
  blankMessage: string;
  errorMessage: (failure: unknown) => string;
  onCreate: (name: string) => Promise<void>;
  keepOpen?: boolean;
  // Each new positive value opens the field and focuses it.
  openSignal?: number;
}

export function QuickCreateField({
  triggerLabel,
  inputLabel,
  placeholder,
  blankMessage,
  errorMessage,
  onCreate,
  keepOpen = false,
  openSignal = 0,
}: Readonly<QuickCreateFieldProps>) {
  const [open, setOpen] = useState(false);
  const [handledSignal, setHandledSignal] = useState(0);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoreFocus = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const hintId = useId();

  if (openSignal !== handledSignal) {
    setHandledSignal(openSignal);
    if (openSignal > 0) setOpen(true);
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open, openSignal]);

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
      setError(blankMessage);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCreate(trimmed);
      if (keepOpen) setName('');
      else close();
    } catch (failure) {
      setError(errorMessage(failure));
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
      event.stopPropagation();
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
        {triggerLabel}
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
        placeholder={placeholder}
        aria-label={inputLabel}
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
