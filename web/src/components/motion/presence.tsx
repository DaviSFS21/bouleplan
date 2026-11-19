'use client';

import { AnimatePresence, MotionGlobalConfig } from 'motion/react';
import type { ReactNode } from 'react';

// With animations skipped (tests) a removed child leaves at once instead of after its exit.
export function Presence({
  children,
  mode = 'sync',
}: Readonly<{ children: ReactNode; mode?: 'sync' | 'popLayout' }>) {
  if (MotionGlobalConfig.skipAnimations === true) return <>{children}</>;
  return (
    <AnimatePresence initial={false} mode={mode}>
      {children}
    </AnimatePresence>
  );
}
