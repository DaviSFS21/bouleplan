import { useEffect, useSyncExternalStore } from 'react';

// The open modal dialogs, innermost last. Anything portaled while one is open goes inside it,
// because content outside an aria-modal dialog is hidden from assistive technology.
let stack: readonly HTMLElement[] = [];
const listeners = new Set<() => void>();

function emit(next: readonly HTMLElement[]) {
  stack = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useModalTarget(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => stack.at(-1) ?? null,
    () => null,
  );
}

export function useRegisterModal(element: HTMLElement | null) {
  useEffect(() => {
    if (!element) return;
    emit([...stack, element]);
    return () => {
      emit(stack.filter((entry) => entry !== element));
    };
  }, [element]);
}
