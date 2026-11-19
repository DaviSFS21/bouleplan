'use client';

import { useIsPresent } from 'motion/react';
import { useCallback, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalKeys } from '@/components/focus-trap/use-modal-keys';
import { useRestoreFocus } from '@/components/focus-trap/use-restore-focus';
import { useModalTarget, useRegisterModal } from '@/components/modal-host/modal-host';
import { SheetFrame } from './sheet-frame';

interface SheetProps {
  // To animate out, mount it inside a Presence instead.
  open?: boolean;
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
  const present = useIsPresent();
  const attach = useCallback((element: HTMLDivElement | null) => {
    setNode(element);
  }, []);
  useRegisterModal(present ? node : null);
  useModalKeys(node, { onEscape: onClose, trap: true });
  useRestoreFocus(present, (previous) => [previous]);

  useLayoutEffect(() => {
    if (!node || !present) return;
    const field = initialFocus?.current;
    // A child that took focus itself, such as a calendar grid, keeps it.
    if (!field && node.contains(document.activeElement)) return;
    (field ?? node).focus();
  }, [node, initialFocus, present]);

  return createPortal(
    <SheetFrame label={label} onClose={onClose} onNode={attach}>
      {children}
    </SheetFrame>,
    host ?? document.body,
  );
}

// A bottom sheet for phones, closed by the handle, the veil or Escape.
export function Sheet({ open = true, ...rest }: Readonly<SheetProps>) {
  return open ? <OpenSheet {...rest} /> : null;
}
