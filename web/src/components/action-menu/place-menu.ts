interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Size {
  width: number;
  height: number;
}

const GAP = 4;
const MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Below the trigger and right-aligned to it; flips above when the room below is short.
export function placeMenu(trigger: Box, menu: Size, viewport: Size): { top: number; left: number } {
  const below = trigger.bottom + GAP;
  const above = trigger.top - GAP - menu.height;
  const fitsBelow = below + menu.height <= viewport.height - MARGIN;
  const roomBelow = viewport.height - trigger.bottom;
  const roomAbove = trigger.top;
  const useAbove = !fitsBelow && (above >= MARGIN || roomAbove > roomBelow);
  return {
    top: clamp(useAbove ? above : below, MARGIN, viewport.height - MARGIN - menu.height),
    left: clamp(trigger.right - menu.width, MARGIN, viewport.width - MARGIN - menu.width),
  };
}
