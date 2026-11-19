import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Candidate = Element | null | undefined;

// The element focused when the modal rendered first, before any child took focus.
function activeElement(): Element | null {
  return typeof document === 'undefined' ? null : document.activeElement;
}

// Returns focus to the first live candidate as the modal leaves; `within` limits it to lost focus.
export function useRestoreFocus(
  present: boolean,
  where: (previous: Element | null) => readonly Candidate[],
  within?: () => HTMLElement | null,
): Element | null {
  const [previous] = useState(activeElement);
  const latest = useRef({ where, within });
  const done = useRef(false);

  useEffect(() => {
    latest.current = { where, within };
  });

  const restoreRef = useRef(() => {
    if (done.current) return;
    done.current = true;
    const { where: candidates, within: scope } = latest.current;
    const active = document.activeElement;
    const lost = !active || active === document.body;
    const inside = scope?.()?.contains(active) === true;
    if (scope && !lost && !inside) return;
    candidates(previous)
      .find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.isConnected && element !== document.body,
      )
      ?.focus();
  });

  useLayoutEffect(() => {
    done.current = false;
    return restoreRef.current;
  }, []);

  useEffect(() => {
    if (!present) restoreRef.current();
  }, [present]);
  return previous;
}
