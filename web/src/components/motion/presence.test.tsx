import { render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig, motion } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { Presence } from './presence';

function Item({ shown }: Readonly<{ shown: boolean }>) {
  return (
    <Presence>
      {shown ? (
        <motion.p key="item" exit={{ opacity: 0, transition: { duration: 0.05 } }}>
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
});
