import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Presence } from '@/components/motion/presence';
import { useToast } from '@/components/toast/toast';
import { renderWithQuery } from '@/test/render';
import { findVeil } from '@/test/viewport';
import { Drawer } from './drawer';

function ToastHarness() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Iniciativas
      </button>
      {open ? (
        <Drawer
          label="Gaveta"
          opener={opener}
          onClose={() => {
            setOpen(false);
          }}
        >
          <button type="button">Primeira</button>
          <button
            type="button"
            onClick={() => {
              toast.show({ message: 'Feito', onUndo: () => undefined });
            }}
          >
            Avisar
          </button>
        </Drawer>
      ) : null}
    </>
  );
}

async function showHostedToast() {
  const user = userEvent.setup();
  renderWithQuery(<ToastHarness />);
  await user.click(screen.getByRole('button', { name: 'Iniciativas' }));
  await user.click(screen.getByRole('button', { name: 'Avisar' }));
  screen.getByRole('button', { name: 'Desfazer' }).focus();
  return user;
}

function Harness({ withOpener = true }: Readonly<{ withOpener?: boolean }>) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={withOpener ? opener : undefined}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Iniciativas
      </button>
      <button type="button">Fora</button>
      {open ? (
        <Drawer
          label="Gaveta"
          opener={opener}
          onClose={() => {
            setOpen(false);
          }}
        >
          <button type="button">Primeira</button>
          <button type="button">Última</button>
        </Drawer>
      ) : null}
    </>
  );
}

describe('Drawer', () => {
  it('opens as a modal dialog and takes focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

    const drawer = screen.getByRole('dialog', { name: 'Gaveta' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveFocus();
  });

  it('keeps Tab inside', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

    await user.tab();
    expect(screen.getByRole('button', { name: 'Primeira' })).toHaveFocus();
    await user.tab();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Primeira' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciativas' })).toHaveFocus();
  });

  it('closes on a tap on the veil', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

    await user.click(findVeil());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciativas' })).toHaveFocus();
  });

  it('returns focus to the previous element when the opener ref is empty', async () => {
    const user = userEvent.setup();
    render(<Harness withOpener={false} />);
    await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Iniciativas' })).toHaveFocus();
  });

  it('keeps Tab inside from the hosted "Desfazer"', async () => {
    const user = await showHostedToast();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Primeira' })).toHaveFocus();
  });

  it('closes on Escape from the hosted "Desfazer"', async () => {
    const user = await showHostedToast();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Drawer exit animation', () => {
  function PresenceHarness() {
    const [open, setOpen] = useState(false);
    const opener = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button
          ref={opener}
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Iniciativas
        </button>
        <Presence>
          {open ? (
            <Drawer
              label="Gaveta"
              opener={opener}
              onClose={() => {
                setOpen(false);
              }}
            >
              <p>Conteúdo</p>
            </Drawer>
          ) : null}
        </Presence>
      </>
    );
  }

  it('hands focus back at once and leaves the leaving drawer inert', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const user = userEvent.setup();
      render(<PresenceHarness />);
      await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

      await user.click(findVeil());

      expect(screen.getByRole('button', { name: 'Iniciativas' })).toHaveFocus();
      expect(document.querySelector('[role="dialog"]')).toHaveAttribute('inert');
      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeNull();
      });
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });
});
