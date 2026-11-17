'use client';

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import styles from './color-picker.module.css';

export const COLOR_TOKENS = [
  'amarelo',
  'lima',
  'verde',
  'turquesa',
  'azul',
  'roxo',
  'rosa',
  'marrom',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

const COLOR_NAMES: Record<ColorToken, string> = {
  amarelo: 'Amarelo',
  lima: 'Lima',
  verde: 'Verde',
  turquesa: 'Turquesa',
  azul: 'Azul',
  roxo: 'Roxo',
  rosa: 'Rosa',
  marrom: 'Marrom',
};

export function colorName(token: ColorToken): string {
  return COLOR_NAMES[token];
}

const STEP_BY_KEY: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

interface ColorPickerProps {
  label: string;
  value: ColorToken;
  onChange: (token: ColorToken) => void;
}

export function ColorPicker({ label, value, onChange }: Readonly<ColorPickerProps>) {
  const swatches = useRef(new Map<ColorToken, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent, token: ColorToken) {
    const step = STEP_BY_KEY[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = COLOR_TOKENS.indexOf(token);
    const next = COLOR_TOKENS[(index + step + COLOR_TOKENS.length) % COLOR_TOKENS.length];
    if (next === undefined) return;
    swatches.current.get(next)?.focus();
    onChange(next);
  }

  return (
    <div role="radiogroup" aria-label={label} className={styles.colors}>
      {COLOR_TOKENS.map((token) => (
        <button
          key={token}
          ref={(element) => {
            if (element) swatches.current.set(token, element);
            else swatches.current.delete(token);
          }}
          type="button"
          role="radio"
          aria-checked={token === value}
          aria-label={colorName(token)}
          tabIndex={token === value ? 0 : -1}
          className={styles.swatch}
          style={{ '--swatch': `var(--ini-${token})` } as CSSProperties}
          onClick={() => {
            onChange(token);
          }}
          onKeyDown={(event) => {
            handleKeyDown(event, token);
          }}
        />
      ))}
    </div>
  );
}
