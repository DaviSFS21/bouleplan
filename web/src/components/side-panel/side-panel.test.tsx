import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from '@/components/action-menu/action-menu';
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
