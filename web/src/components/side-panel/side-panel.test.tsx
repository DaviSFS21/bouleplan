import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { useToast } from '@/components/toast/toast';
import { renderWithQuery } from '@/test/render';
import { PHONE, setViewport } from '@/test/viewport';
import { SidePanel } from './side-panel';

function Harness({ withOpenerRef = false }: Readonly<{ withOpenerRef?: boolean }>) {
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
        Abrir painel
      </button>
      <button type="button">Outro</button>
      {open ? (
        <SidePanel
          label="Detalhes da iniciativa"
          eyebrow="Iniciativa"
          opener={withOpenerRef ? opener : undefined}
          actions={
            <ActionMenu
              label="Ações da iniciativa"
              items={[{ label: 'Arquivar', onSelect: vi.fn() }]}
            />
          }
          footer="Salva automaticamente"
          onClose={() => {
            setOpen(false);
          }}
        >
          <p>Conteúdo</p>
        </SidePanel>
      ) : null}
    </>
  );
}

describe('SidePanel', () => {
  it('renders a labeled aside with header slots, content and footer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    const panel = screen.getByRole('complementary', { name: 'Detalhes da iniciativa' });
    expect(panel).toHaveTextContent('Iniciativa');
    expect(panel).toHaveTextContent('Conteúdo');
    expect(panel).toHaveTextContent('Salva automaticamente');
    expect(screen.getByRole('button', { name: 'Ações da iniciativa' })).toBeInTheDocument();
  });

  it('omits the footer when none is given', () => {
    render(
      <SidePanel label="Painel" eyebrow="Tarefa" onClose={vi.fn()}>
        Conteúdo
      </SidePanel>,
    );

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('moves focus into the panel on open', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    expect(screen.getByRole('complementary')).toHaveFocus();
  });

  it('closes with the close button and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir painel' })).toHaveFocus();
  });

  it('returns focus to the opener ref when given', async () => {
    const user = userEvent.setup();
    render(<Harness withOpenerRef />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Abrir painel' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('keeps the panel open when Escape closes a menu inside it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));
    await user.click(screen.getByRole('button', { name: 'Ações da iniciativa' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SidePanel label="Painel" eyebrow="Tarefa" onClose={onClose}>
        Conteúdo
      </SidePanel>,
    );

    await user.keyboard('a');

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SidePanel eyebrow style', () => {
  it('shows the path style as plain text and keeps links inside it', () => {
    render(
      <SidePanel
        label="Tarefa"
        eyebrow={<a href="/x">Reforma</a>}
        eyebrowStyle="path"
        onClose={vi.fn()}
      >
        <p>Conteúdo</p>
      </SidePanel>,
    );

    const link = screen.getByRole('link', { name: 'Reforma' });
    expect(link.parentElement?.className).toContain('path');
    expect(link.parentElement?.className).not.toContain('eyebrow');
  });
});

describe('SidePanel on a phone', () => {
  function PhoneHarness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Abrir painel
        </button>
        {open ? (
          <SidePanel
            label="Tarefa"
            eyebrow={<a href="/x">Reforma</a>}
            eyebrowStyle="path"
            actions={
              <ActionMenu
                label="Ações da tarefa"
                items={[{ label: 'Excluir', onSelect: vi.fn() }]}
              />
            }
            onClose={() => {
              setOpen(false);
            }}
          >
            <button type="button">Campo</button>
          </SidePanel>
        ) : null}
      </>
    );
  }

  it('is a full-screen modal dialog with "Voltar" instead of "×"', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);

    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    const dialog = screen.getByRole('dialog', { name: 'Tarefa' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('puts the path below the header', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);

    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    const header = screen.getByRole('banner');
    expect(header).not.toHaveTextContent('Reforma');
    expect(screen.getByRole('link', { name: 'Reforma' })).toBeInTheDocument();
  });

  it('returns focus to the opener on "Voltar"', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir painel' })).toHaveFocus();
  });

  it('keeps Tab inside the panel', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Campo' })).toHaveFocus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus();
  });

  it('refocuses the panel when the screen turns, since the header swaps its buttons', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));
    screen.getByRole('button', { name: 'Voltar' }).focus();

    setViewport({ width: 1440, coarse: false });

    expect(screen.getByRole('complementary', { name: 'Tarefa' })).toHaveFocus();
  });

  it('keeps the sheet menu inside the modal dialog', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa' }));

    expect(screen.getByRole('dialog', { name: 'Tarefa' })).toContainElement(
      screen.getByRole('menu'),
    );
  });

  it('keeps Tab inside the sheet, not handing it to the panel behind', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<PhoneHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));
    await user.click(screen.getByRole('button', { name: 'Ações da tarefa' }));

    await user.tab();

    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveFocus();
  });

  it('shows the toasts inside the dialog, so "Desfazer" stays reachable', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    renderWithQuery(<ToastHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));
    await user.click(screen.getByRole('button', { name: 'Avisar' }));

    const dialog = screen.getByRole('dialog', { name: 'Tarefa' });
    expect(within(dialog).getByRole('status', { name: 'Avisos' })).toHaveTextContent('Feito');
    expect(within(dialog).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Feito');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves a toast already showing into the dialog without remounting it', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    renderWithQuery(<EarlyToastHarness />);
    await user.click(screen.getByRole('button', { name: 'Avisar' }));
    const message = screen.getByText('Feito');

    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));

    const dialog = screen.getByRole('dialog', { name: 'Tarefa' });
    expect(within(dialog).getByText('Feito')).toBe(message);
  });

  it('keeps Tab inside from the hosted "Desfazer"', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    renderWithQuery(<ToastHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));
    await user.click(screen.getByRole('button', { name: 'Avisar' }));
    screen.getByRole('button', { name: 'Desfazer' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus();
  });

  it('closes on Escape from the hosted "Desfazer"', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    renderWithQuery(<ToastHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir painel' }));
    await user.click(screen.getByRole('button', { name: 'Avisar' }));
    screen.getByRole('button', { name: 'Desfazer' }).focus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

function EarlyToastHarness() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          toast.show({ message: 'Feito', onUndo: vi.fn() });
        }}
      >
        Avisar
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir painel
      </button>
      {open ? (
        <SidePanel
          label="Tarefa"
          eyebrow="Tarefa"
          onClose={() => {
            setOpen(false);
          }}
        >
          <p>Conteúdo</p>
        </SidePanel>
      ) : null}
    </>
  );
}

function ToastHarness() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir painel
      </button>
      {open ? (
        <SidePanel
          label="Tarefa"
          eyebrow="Tarefa"
          onClose={() => {
            setOpen(false);
          }}
        >
          <button
            type="button"
            onClick={() => {
              toast.show({ message: 'Feito', onUndo: vi.fn() });
            }}
          >
            Avisar
          </button>
        </SidePanel>
      ) : null}
    </>
  );
}
