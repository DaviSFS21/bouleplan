'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { TaskPriority } from '@/api/types';
import { seloClassName } from '@/components/selo/selo';
import { PRIORITIES } from './task-menu';
import styles from './task-panel.module.css';

const STEP_BY_KEY: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

interface PriorityFieldProps {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
}

export function PriorityField({ value, onChange }: Readonly<PriorityFieldProps>) {
  const radios = useRef(new Map<TaskPriority, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent, priority: TaskPriority) {
    const step = STEP_BY_KEY[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = PRIORITIES.indexOf(priority);
    const next = PRIORITIES[(index + step + PRIORITIES.length) % PRIORITIES.length];
    if (next === undefined) return;
    radios.current.get(next)?.focus();
    onChange(next);
  }

  return (
    <div role="radiogroup" aria-label="Prioridade" className={styles.priorities}>
      {PRIORITIES.map((priority) => (
        <button
          key={priority}
          ref={(element) => {
            if (element) radios.current.set(priority, element);
            else radios.current.delete(priority);
          }}
          type="button"
          role="radio"
          aria-checked={priority === value}
          tabIndex={priority === value ? 0 : -1}
          className={[seloClassName(priority), styles.priority].join(' ')}
          onClick={() => {
            onChange(priority);
          }}
          onKeyDown={(event) => {
            handleKeyDown(event, priority);
          }}
        >
          {priority}
        </button>
      ))}
    </div>
  );
}
