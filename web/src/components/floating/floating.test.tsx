import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Presence } from '@/components/motion/presence';
import { Floating } from './floating';

function anchor() {
  return document.querySelector<HTMLElement>('[data-anchor]');
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-anchor=""
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir
      </button>
      <Presence>
        {open ? (
          <Floating
            key="box"
            anchor={anchor}
            label="Caixa"
            onClose={() => {
              setOpen(false);
            }}
          >
            <button type="button">Dentro</button>
          </Floating>
        ) : null}
      </Presence>
    </>
  );
}

describe('Floating', () => {
  it('takes focus, closes on Escape and gives focus back to its anchor', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog', { name: 'Caixa' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('is revived whole when it is reopened while it fades out', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole('button', { name: 'Abrir' }));
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog', { name: 'Caixa' })).toHaveAttribute('inert');

      await user.keyboard('{Enter}');

      const dialog = screen.getByRole('dialog', { name: 'Caixa' });
      await waitFor(() => {
        expect(dialog).not.toHaveAttribute('inert');
      });
      expect(dialog).toHaveFocus();

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });
});
