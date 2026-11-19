import { useEffect, useRef } from 'react';
import { ownsKeys } from '@/components/modal-host/modal-host';
import { isCancellingEdit } from './cancel-editing';
import { trapTab } from './trap-tab';

// A document listener, not React's onKeyDown: portaled children (the toast) are DOM descendants
// but not React children. React handlers that stop propagation still win, as they run at the root first.
export function useModalKeys(
  modal: HTMLElement | null,
  { onEscape, trap }: Readonly<{ onEscape: () => void; trap: boolean }>,
) {
  const escape = useRef(onEscape);

  useEffect(() => {
    escape.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!modal) return;
    function handle(event: KeyboardEvent) {
      if (isCancellingEdit()) return;
      if (!(event.target instanceof Node) || !modal?.contains(event.target)) return;
      if (!ownsKeys(modal, event.target)) return;
      if (event.key === 'Escape') escape.current();
      else if (trap) trapTab(event, modal);
    }
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
    };
  }, [modal, trap]);
}
