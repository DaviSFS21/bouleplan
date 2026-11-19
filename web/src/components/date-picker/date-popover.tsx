'use client';

import type { ReactNode } from 'react';
import { Floating } from '@/components/floating/floating';
import { useIsPhone } from '@/components/responsive/use-media-query';
import { Sheet } from '@/components/sheet/sheet';

interface DatePopoverProps {
  anchor: () => HTMLElement | null;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

// The calendar sits next to its trigger on a desktop and rises as a sheet on a phone.
export function DatePopover({ anchor, label, onClose, children }: Readonly<DatePopoverProps>) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <Sheet open label={label} onClose={onClose}>
        {children}
      </Sheet>
    );
  }
  return (
    <Floating anchor={anchor} label={label} onClose={onClose}>
      {children}
    </Floating>
  );
}
