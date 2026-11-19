'use client';

import { MotionConfig, MotionGlobalConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useMediaQuery } from '@/components/responsive/use-media-query';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Reduced motion also drops fades: a veil or menu that lingers while it fades out still blocks the page.
export function MotionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  useEffect(() => {
    if (!reduced) return undefined;
    MotionGlobalConfig.skipAnimations = true;
    return () => {
      MotionGlobalConfig.skipAnimations = false;
    };
  }, [reduced]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
