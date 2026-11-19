import { MotionGlobalConfig, type Transition } from 'motion/react';

// Seconds, as motion expects. The design system's 650 ms is only for larger state changes.
export const DURATION = { exit: 0.18, enter: 0.22, emphasis: 0.65 } as const;

export const EASE = {
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  emphasis: [0.4, 0, 0.2, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const ENTER: Transition = { duration: DURATION.enter, ease: EASE.enter };
export const EXIT: Transition = { duration: DURATION.exit, ease: EASE.exit };
export const EMPHASIS: Transition = { duration: DURATION.emphasis, ease: EASE.emphasis };

export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: ENTER },
  exit: { opacity: 0, transition: EXIT },
} as const;

export const POP = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: ENTER },
  exit: { opacity: 0, scale: 0.96, transition: EXIT },
} as const;

export const RISE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: ENTER },
  exit: { opacity: 0, y: 8, transition: EXIT },
} as const;

export const SLIDE_RIGHT = {
  initial: { x: '100%' },
  animate: { x: 0, transition: ENTER },
  exit: { x: '100%', transition: EXIT },
} as const;

export const SLIDE_LEFT = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: ENTER },
  exit: { x: '-100%', transition: EXIT },
} as const;

export const SLIDE_UP = {
  initial: { y: '100%' },
  animate: { y: 0, transition: ENTER },
  exit: { y: '100%', transition: EXIT },
} as const;

// Cards and rows that enter, leave or change place within a list.
export const ITEM = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: ENTER },
  exit: { opacity: 0, scale: 0.98, transition: EXIT },
} as const;

export const LAYOUT_TRANSITION: Transition = { layout: ENTER };

interface Preset {
  readonly initial: object;
  readonly animate: object;
  readonly exit: object;
}

// With animations skipped (tests) the element starts in its final state instead of waiting a frame.
export function preset<T extends Preset>(value: T): T | (Omit<T, 'initial'> & { initial: false }) {
  return MotionGlobalConfig.skipAnimations === true ? { ...value, initial: false } : value;
}
