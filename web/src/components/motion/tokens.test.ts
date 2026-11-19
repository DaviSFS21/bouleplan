import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { DURATION, EASE, FADE, preset, sharedLayout } from './tokens';

const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

function cssValue(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`Missing --${name}`);
  return match[1];
}

describe('motion tokens', () => {
  it('keep the UI transitions between 180 and 240 ms and the large one at 650 ms', () => {
    expect(DURATION.exit).toBeGreaterThanOrEqual(0.18);
    expect(DURATION.enter).toBeLessThanOrEqual(0.24);
    expect(DURATION.emphasis).toBe(0.65);
  });

  it('match the CSS custom properties used by stylesheets', () => {
    expect(cssValue('motion-enter')).toBe(`${String(DURATION.enter * 1000)}ms`);
    expect(cssValue('motion-exit')).toBe(`${String(DURATION.exit * 1000)}ms`);
    expect(cssValue('ease-enter')).toBe(`cubic-bezier(${EASE.enter.join(', ')})`);
    expect(cssValue('ease-exit')).toBe(`cubic-bezier(${EASE.exit.join(', ')})`);
  });

  it('starts in the final state while animations are skipped, and as designed otherwise', () => {
    expect(preset(FADE).initial).toBe(false);

    MotionGlobalConfig.skipAnimations = false;
    try {
      expect(preset(FADE).initial).toEqual({ opacity: 0 });
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });

  it('shares a card layout only while animating, and keeps a dragged one still', () => {
    expect(sharedLayout('card-1', false)).toEqual({});

    MotionGlobalConfig.skipAnimations = false;
    try {
      expect(sharedLayout('card-1', false)).toEqual({ layout: 'position', layoutId: 'card-1' });
      expect(sharedLayout('card-1', true)).toEqual({ layout: false, layoutId: 'card-1' });
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });
});
