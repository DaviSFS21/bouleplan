import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { findVeil } from '@/test/viewport';
import { Sheet } from './sheet';

function Harness({ onClose }: Readonly<{ onClose?: () => void }>) {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir
      </button>
      <Sheet
        open={open}
        label="Editar"
        initialFocus={field}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <input ref={field} aria-label="Campo" />
        <button type="button">Salvar</button>
      </Sheet>
    </>
  );
}

function pointer(target: Element, type: string, clientY: number, timeStamp: number) {
  const event = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    timeStamp: { value: timeStamp },
  });
  fireEvent(target, event);
}

function handle(): Element {
  const element = document.querySelector('[data-sheet-handle]');
  if (!element) throw new Error('No handle');
  return element;
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal dialog named by its label, focused on the requested field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('dialog', { name: 'Editar' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Campo' })).toHaveFocus();
  });

  it('focuses the dialog when no field is requested', () => {
    render(
      <Sheet open label="Vazio" onClose={vi.fn()}>
        <p>Texto</p>
      </Sheet>,
    );

    expect(screen.getByRole('dialog', { name: 'Vazio' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('closes when the veil is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.click(findVeil());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the sheet', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.tab();
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Campo' })).toHaveFocus();
  });

  it('closes when the handle is dragged down past the threshold', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    pointer(handle(), 'pointerdown', 100, 0);
    pointer(handle(), 'pointermove', 140, 400);
    pointer(handle(), 'pointermove', 260, 800);
    pointer(handle(), 'pointerup', 260, 1500);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a quick flick shorter than the distance', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    pointer(handle(), 'pointerdown', 100, 0);
    pointer(handle(), 'pointermove', 125, 20);
    pointer(handle(), 'pointerup', 125, 40);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back on a short slow drag, an upward drag and a cancelled one', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    pointer(handle(), 'pointerdown', 100, 0);
    pointer(handle(), 'pointermove', 110, 500);
    pointer(handle(), 'pointerup', 110, 1000);
    pointer(handle(), 'pointerdown', 100, 2000);
    pointer(handle(), 'pointermove', 20, 2500);
    pointer(handle(), 'pointerup', 20, 3000);
    pointer(handle(), 'pointerdown', 100, 4000);
    pointer(handle(), 'pointermove', 300, 4500);
    pointer(handle(), 'pointercancel', 300, 5000);
    pointer(handle(), 'pointerup', 300, 5500);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Editar' })).toBeInTheDocument();
  });

  it('captures the pointer while dragging, where the browser supports it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const capture = vi.fn();
    Object.assign(handle(), { setPointerCapture: capture });

    pointer(handle(), 'pointerdown', 100, 0);

    expect(capture).toHaveBeenCalledWith(1);
  });

  it('ignores moves and releases that did not start on the handle', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    pointer(handle(), 'pointermove', 400, 100);
    pointer(handle(), 'pointerup', 400, 200);

    expect(onClose).not.toHaveBeenCalled();
  });
});
