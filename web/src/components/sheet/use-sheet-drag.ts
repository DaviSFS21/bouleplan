import { animate, useMotionValue, type MotionValue } from 'motion/react';
import { useRef, type PointerEvent } from 'react';
import { ENTER } from '@/components/motion/tokens';
import { shouldDismiss } from './dismiss';

// A pause before lifting the finger cancels a flick.
const RESTING_MS = 100;

interface Gesture {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
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

// The sheet follows the pointer down only; it closes past the threshold or on a flick, else springs back.
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
          lastY: event.clientY,
          lastTime: event.timeStamp,
          velocity: 0,
        };
        // jsdom has no pointer capture.
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      },
      onPointerMove: (event) => {
        const current = gesture.current;
        if (current?.pointerId !== event.pointerId) return;
        const elapsed = Math.max(event.timeStamp - current.lastTime, 1);
        current.velocity = (event.clientY - current.lastY) / elapsed;
        current.lastY = event.clientY;
        current.lastTime = event.timeStamp;
        y.set(Math.max(0, event.clientY - current.startY));
      },
      onPointerUp: (event) => {
        const current = gesture.current;
        if (current?.pointerId !== event.pointerId) return;
        gesture.current = null;
        const height = sheet.current?.getBoundingClientRect().height ?? 0;
        const resting = event.timeStamp - current.lastTime > RESTING_MS;
        if (shouldDismiss(y.get(), resting ? 0 : current.velocity, height)) onDismiss();
        else settle();
      },
      onPointerCancel: (event) => {
        if (gesture.current?.pointerId === event.pointerId) settle();
      },
    },
  };
}
