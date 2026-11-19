import { animate, useMotionValue, type MotionValue } from 'motion/react';
import { useRef, type PointerEvent } from 'react';
import { ENTER } from '@/components/motion/tokens';
import { shouldDismiss } from './dismiss';

// A flick's speed is averaged over this window.
const WINDOW_MS = 100;

interface Sample {
  y: number;
  time: number;
}

interface Gesture {
  pointerId: number;
  startY: number;
  samples: Sample[];
}

// px/ms downward over the recent window, 0 after a pause.
function velocityAt(samples: readonly Sample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.time <= WINDOW_MS);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.time === first.time) return 0;
  return (last.y - first.y) / (last.time - first.time);
}

export interface SheetDrag {
  y: MotionValue<number>;
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  };
}

// Follows the pointer down; closes past the threshold or on a flick, else springs back.
export function useSheetDrag(
  sheet: { current: HTMLElement | null },
  onDismiss: () => void,
): SheetDrag {
  const y = useMotionValue(0);
  const gesture = useRef<Gesture | null>(null);

  function settle() {
    gesture.current = null;
    void animate(y, 0, ENTER);
  }

  return {
    y,
    handlers: {
      onPointerDown: (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        gesture.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          samples: [{ y: event.clientY, time: event.timeStamp }],
        };
        // jsdom has no pointer capture.
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      },
      onPointerMove: (event) => {
        const current = gesture.current;
        if (current?.pointerId !== event.pointerId) return;
        current.samples.push({ y: event.clientY, time: event.timeStamp });
        y.set(Math.max(0, event.clientY - current.startY));
      },
      onPointerUp: (event) => {
        const current = gesture.current;
        if (current?.pointerId !== event.pointerId) return;
        gesture.current = null;
        const height = sheet.current?.getBoundingClientRect().height ?? 0;
        const velocity = velocityAt(current.samples, event.timeStamp);
        if (shouldDismiss(y.get(), velocity, height)) onDismiss();
        else settle();
      },
      onPointerCancel: (event) => {
        if (gesture.current?.pointerId === event.pointerId) settle();
      },
    },
  };
}
