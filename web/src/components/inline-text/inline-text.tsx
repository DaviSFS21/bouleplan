'use client';

import { CircleAlert } from 'lucide-react';
import {
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
}: Readonly<InlineTextProps>) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const reverting = useRef(false);
  const errorId = useId();

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDraft(event.target.value);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (reverting.current) {
      reverting.current = false;
      return;
    }
    if (event.currentTarget.value !== value) onCommit(event.currentTarget.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      reverting.current = true;
      setDraft(value);
      event.currentTarget.blur();
    } else if (event.key === 'Enter' && !multiline && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  const shared = {
    className: [styles.field, styles[variant]].join(' '),
    'aria-label': label,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
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
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon icon={CircleAlert} size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
