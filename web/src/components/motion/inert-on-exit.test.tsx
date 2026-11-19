import { render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig, motion } from 'motion/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { InertOnExit } from './inert-on-exit';
import { Presence } from './presence';
import { FADE, preset } from './tokens';

function Layer({ shown }: Readonly<{ shown: boolean }>) {
  const box = useRef<HTMLDivElement>(null);
  const targets = [box];
  return (
    <Presence>
      {shown ? (
        <motion.div key="layer" ref={box} {...preset(FADE)}>
          <button type="button">Dentro</button>
          <InertOnExit targets={targets} />
        </motion.div>
      ) : null}
    </Presence>
  );
}

describe('InertOnExit', () => {
  it('makes the element inert while it fades out, and not before', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const { rerender } = render(<Layer shown />);
      const button = screen.getByRole('button', { name: 'Dentro' });
      expect(button.parentElement).not.toHaveAttribute('inert');

      rerender(<Layer shown={false} />);
      await waitFor(() => {
        expect(button.parentElement).toHaveAttribute('inert');
      });
      await waitFor(() => {
        expect(button).not.toBeInTheDocument();
      });
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });

  it('wakes the element again when the child returns while it is leaving', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const { rerender } = render(<Layer shown />);
      const button = screen.getByRole('button', { name: 'Dentro' });

      rerender(<Layer shown={false} />);
      await waitFor(() => {
        expect(button.parentElement).toHaveAttribute('inert');
      });
      rerender(<Layer shown />);

      await waitFor(() => {
        expect(button.parentElement).not.toHaveAttribute('inert');
      });
      expect(button).toBeInTheDocument();
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });
});
