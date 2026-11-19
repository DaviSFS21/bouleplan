import { render } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from './motion-provider';

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: reduce && query.includes('prefers-reduced-motion'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  MotionGlobalConfig.skipAnimations = true;
});

describe('MotionProvider', () => {
  it('skips every animation, fades included, while reduced motion is preferred', () => {
    MotionGlobalConfig.skipAnimations = false;
    preferReducedMotion(true);

    const { unmount } = render(<MotionProvider>content</MotionProvider>);
    expect(MotionGlobalConfig.skipAnimations).toBe(true);

    unmount();
    expect(MotionGlobalConfig.skipAnimations).toBe(false);
  });

  it('leaves animations alone otherwise', () => {
    MotionGlobalConfig.skipAnimations = false;
    preferReducedMotion(false);

    render(<MotionProvider>content</MotionProvider>);

    expect(MotionGlobalConfig.skipAnimations).toBe(false);
  });
});
