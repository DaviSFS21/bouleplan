import { act } from '@testing-library/react';
import { afterEach } from 'vitest';

interface Viewport {
  width: number;
  coarse: boolean;
}

const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const listeners = new Map<MediaQueryListStub, () => void>();
let current: Viewport = { width: 1440, coarse: false };

interface MediaQueryListStub {
  media: string;
  readonly matches: boolean;
}

function evaluate(query: string): boolean {
  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (max) return current.width <= Number(max[1]);
  if (min) return current.width >= Number(min[1]);
  if (query.includes('pointer: coarse')) return current.coarse;
  return false;
}

function stubbedMatchMedia(query: string) {
  const list = {
    media: query,
    get matches() {
      return evaluate(query);
    },
    addEventListener: (_type: string, listener: () => void) => {
      listeners.set(list, listener);
    },
    removeEventListener: () => {
      listeners.delete(list);
    },
  };
  return list;
}

// Stubs matchMedia for the width and pointer type; changing it later notifies the subscribers.
export function setViewport(next: Partial<Viewport>) {
  current = { ...current, ...next };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: stubbedMatchMedia,
  });
  act(() => {
    listeners.forEach((listener) => {
      listener();
    });
  });
}

export const PHONE = { width: 390, coarse: true } as const;
export const TABLET = { width: 900, coarse: true } as const;

afterEach(() => {
  current = { width: 1440, coarse: false };
  listeners.clear();
  if (original) Object.defineProperty(window, 'matchMedia', original);
  else Reflect.deleteProperty(window, 'matchMedia');
});

// The veil behind a drawer or a sheet: a decorative element that closes it on a tap.
export function findVeil(): HTMLElement {
  const veil = document.body.querySelector<HTMLElement>('[class*="veil"]');
  if (!veil) throw new Error('Expected a veil on the page.');
  return veil;
}
