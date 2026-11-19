'use client';

import type { ReactNode, RefObject } from 'react';
import { useIsPhone } from '@/components/responsive/use-media-query';
import { Sheet } from '@/components/sheet/sheet';
import { Floating } from './floating';

interface PopoverProps {
  anchor: () => HTMLElement | null;
  label: string;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

// Next to its anchor on a desktop, a bottom sheet on a phone. Mount it inside a Presence.
export function Popover({
  anchor,
  label,
  onClose,
  initialFocus,
  className,
  children,
}: Readonly<PopoverProps>) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <Sheet label={label} onClose={onClose} initialFocus={initialFocus}>
        {children}
      </Sheet>
    );
  }
  return (
    <Floating
      anchor={anchor}
      label={label}
      onClose={onClose}
      initialFocus={initialFocus}
      className={className}
    >
      {children}
    </Floating>
  );
}
