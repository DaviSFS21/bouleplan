'use client';

import { AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

export function Presence({
  children,
  mode = 'sync',
}: Readonly<{ children: ReactNode; mode?: 'sync' | 'popLayout' }>) {
  return (
    <AnimatePresence initial={false} mode={mode}>
      {children}
    </AnimatePresence>
  );
}
