'use client';

import { useIsPresent } from 'motion/react';
import { useEffect, type RefObject } from 'react';

// Renders nothing: while its Presence child leaves, the given elements stop taking input.
export function InertOnExit({
  targets,
}: Readonly<{ targets: readonly RefObject<HTMLElement | null>[] }>) {
  const present = useIsPresent();
  useEffect(() => {
    if (present) return;
    targets.forEach((target) => {
      target.current?.setAttribute('inert', '');
    });
  }, [present, targets]);
  return null;
}
