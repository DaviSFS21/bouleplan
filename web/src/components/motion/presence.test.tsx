import { render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig, motion } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { Presence } from './presence';
import { FADE, preset } from './tokens';

function Item({ shown }: Readonly<{ shown: boolean }>) {
  return (
    <Presence>
      {shown ? (
        <motion.p key="item" {...preset(FADE)}>
          Item
        </motion.p>
      ) : null}
    </Presence>
  );
}

describe('Presence', () => {
  it('removes a child at once while animations are skipped', () => {
    const { rerender } = render(<Item shown />);

    rerender(<Item shown={false} />);

    expect(screen.queryByText('Item')).not.toBeInTheDocument();
  });

  it('keeps a child until its exit animation ends', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const { rerender } = render(<Item shown />);

      rerender(<Item shown={false} />);
      expect(screen.getByText('Item')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Item')).not.toBeInTheDocument();
      });
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });

  it('does not remount an open child when reduced motion toggles', () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const { rerender } = render(<Item shown />);
      const before = screen.getByText('Item');

      MotionGlobalConfig.skipAnimations = true;
      rerender(<Item shown />);

      expect(screen.getByText('Item')).toBe(before);
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });
});
