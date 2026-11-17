import { describe, expect, it } from 'vitest';
import { placeMenu } from './place-menu';

const viewport = { width: 1000, height: 700 };
const menu = { width: 200, height: 300 };

function trigger(top: number, right = 500) {
  return { top, bottom: top + 28, left: right - 28, right };
}

describe('placeMenu', () => {
  it('opens below the trigger, right-aligned to it', () => {
    expect(placeMenu(trigger(100), menu, viewport)).toEqual({ top: 132, left: 300 });
  });

  it('flips above when there is no room below but there is above', () => {
    expect(placeMenu(trigger(500), menu, viewport)).toEqual({ top: 196, left: 300 });
  });

  it('stays on the roomier side and inside the screen when neither fits', () => {
    const tiny = { width: 1000, height: 400 };

    expect(placeMenu(trigger(150), menu, tiny).top).toBe(92);
    expect(placeMenu(trigger(260), { width: 200, height: 360 }, tiny).top).toBe(8);
    expect(placeMenu(trigger(60), { width: 200, height: 380 }, tiny).top).toBe(12);
  });

  it('keeps a margin from the left and right edges', () => {
    expect(placeMenu(trigger(100, 100), menu, viewport).left).toBe(8);
    expect(placeMenu(trigger(100, 990), menu, viewport).left).toBe(790);
  });
});
