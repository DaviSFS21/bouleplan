'use client';

import { useCallback, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalKeys } from '@/components/focus-trap/use-modal-keys';
import { Presence } from '@/components/motion/presence';
import { useModalTarget, useRegisterModal } from '@/components/modal-host/modal-host';
import { SheetFrame } from './sheet-frame';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  // The accessible name of the dialog.
  label: string;
  // Where focus goes on open; the dialog itself by default.
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

function OpenSheet({ onClose, label, initialFocus, children }: Readonly<Omit<SheetProps, 'open'>>) {
  // Fixed at mount: once this sheet registers itself, the target would be the sheet.
  const [host] = useState(useModalTarget());
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => {
    setNode(element);
  }, []);
  useRegisterModal(node);
  useModalKeys(node, { onEscape: onClose, trap: true });

  useLayoutEffect(() => {
    if (!node) return;
    const previous = document.activeElement;
    (initialFocus?.current ?? node).focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [node, initialFocus]);

  return createPortal(
    <SheetFrame label={label} onClose={onClose} onNode={attach}>
      {children}
    </SheetFrame>,
    host ?? document.body,
  );
}

// A bottom sheet for phones: drag the handle down or tap the veil to close. Keep the content
// short of its own scroll: the sheet scrolls it from about 90% of the viewport.
export function Sheet({ open, ...rest }: Readonly<SheetProps>) {
  return <Presence>{open ? <OpenSheet {...rest} /> : null}</Presence>;
}
