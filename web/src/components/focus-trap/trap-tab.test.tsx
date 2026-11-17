import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';
import { trapTab } from './trap-tab';

function Trap({ empty = false, portal = false }: Readonly<{ empty?: boolean; portal?: boolean }>) {
  const box = useRef<HTMLDivElement>(null);
  return (
    <>
      <button type="button">Antes</button>
      <div
        ref={box}
        role="group"
        aria-label="Caixa"
        tabIndex={-1}
        onKeyDown={(event) => {
          trapTab(event, box.current);
        }}
      >
        {portal ? createPortal(<button type="button">Portal</button>, document.body) : null}
        {empty ? null : (
          <>
            <button type="button">Primeiro</button>
            <button type="button" disabled>
              Desligado
            </button>
            <button type="button" hidden>
              Escondido
            </button>
            <a href="/x">Último</a>
          </>
        )}
      </div>
      <button type="button">Depois</button>
    </>
  );
}

describe('trapTab', () => {
  it('wraps Tab from the last control to the first', async () => {
    const user = userEvent.setup();
    render(<Trap />);
    screen.getByRole('link', { name: 'Último' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first control to the last', async () => {
    const user = userEvent.setup();
    render(<Trap />);
    screen.getByRole('button', { name: 'Primeiro' }).focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('link', { name: 'Último' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the container itself to the last control', async () => {
    const user = userEvent.setup();
    render(<Trap />);
    screen.getByRole('group', { name: 'Caixa' }).focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('link', { name: 'Último' })).toHaveFocus();
  });

  it('leaves Tab alone between controls and ignores other keys', async () => {
    const user = userEvent.setup();
    render(<Trap />);
    screen.getByRole('button', { name: 'Primeiro' }).focus();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Último' })).toHaveFocus();

    await user.keyboard('a');
    expect(screen.getByRole('link', { name: 'Último' })).toHaveFocus();
  });

  it('keeps focus in a container without controls', async () => {
    const user = userEvent.setup();
    render(<Trap empty />);
    screen.getByRole('group', { name: 'Caixa' }).focus();

    await user.tab();

    expect(screen.getByRole('group', { name: 'Caixa' })).toHaveFocus();
  });

  it('leaves alone a key pressed in a portal, which is not inside the container', async () => {
    const user = userEvent.setup();
    render(<Trap portal />);
    screen.getByRole('button', { name: 'Portal' }).focus();

    await user.tab();

    expect(screen.getByRole('group', { name: 'Caixa' })).not.toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});
