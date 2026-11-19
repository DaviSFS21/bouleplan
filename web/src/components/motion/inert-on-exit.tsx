'use client';

import { useIsPresent } from 'motion/react';
import { useEffect, type RefObject } from 'react';

// Renders nothing: while its Presence child leaves, the elements stop taking input; they wake if it returns.
export function InertOnExit({
  targets,
}: Readonly<{ targets: readonly RefObject<HTMLElement | null>[] }>) {
  const present = useIsPresent();
  useEffect(() => {
    targets.forEach((target) => {
      if (present) target.current?.removeAttribute('inert');
      else target.current?.setAttribute('inert', '');
    });
  }, [present, targets]);
  return null;
}
