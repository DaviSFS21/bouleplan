'use client';

import { CircleAlert } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './inline-text.module.css';

interface InlineTextProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  variant?: 'title' | 'body';
  maxLength?: number;
  placeholder?: string;
  error?: string | null;
  validate?: (value: string) => string | null;
  focusSignal?: number;
  trim?: boolean;
}

export function InlineText({
  label,
  value,
  onCommit,
  multiline = false,
  variant = 'body',
  maxLength,
  placeholder,
  error,
  validate,
  focusSignal = 0,
  trim = false,
}: Readonly<InlineTextProps>) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const reverting = useRef(false);
  const [validation, setValidation] = useState<string | null>(null);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const errorId = useId();
  const shownError = validation ?? error;

  useEffect(() => {
    if (focusSignal === 0) return;
    field.current?.focus();
    field.current?.select();
  }, [focusSignal]);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDraft(event.target.value);
    setValidation(null);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (reverting.current) {
      reverting.current = false;
      return;
    }
    const next = trim ? event.currentTarget.value.trim() : event.currentTarget.value;
    if (next === value) {
      setDraft(value);
      return;
    }
    const message = validate?.(next) ?? null;
    if (message) {
      setValidation(message);
      setDraft(value);
      return;
    }
    setDraft(next);
    onCommit(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      reverting.current = true;
      setDraft(value);
      setValidation(null);
      event.currentTarget.blur();
    } else if (event.key === 'Enter' && !multiline && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  const shared = {
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      field.current = element;
    },
    className: [styles.field, styles[variant]].join(' '),
    'aria-label': label,
    'aria-invalid': shownError ? true : undefined,
    'aria-describedby': shownError ? errorId : undefined,
    value: draft,
    maxLength,
    placeholder,
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };

  return (
    <div className={styles.wrapper}>
      {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type="text" />}
      {shownError ? (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon icon={CircleAlert} size={14} />
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
