import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastOptions } from './toast';

function Trigger({
  options,
  label = 'Mostrar',
}: Readonly<{ options: ToastOptions; label?: string }>) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        toast.show(options);
      }}
    >
      {label}
    </button>
  );
}

function setup(options: ToastOptions) {
  render(
    <ToastProvider>
      <Trigger options={options} />
      <Trigger options={{ message: 'Outro aviso', onUndo: vi.fn() }} label="Outro" />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('announces the message in a status region with an undo button', () => {
    setup({ message: 'Iniciativa arquivada', onUndo: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent(
      'Iniciativa arquivada',
    );
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('undoes and closes', () => {
    const onUndo = vi.fn();
    setup({ message: 'Iniciativa arquivada', onUndo });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Iniciativa arquivada')).not.toBeInTheDocument();
  });

  it('dismisses itself after 6 seconds without undoing', () => {
    const onUndo = vi.fn();
    setup({ message: 'Iniciativa arquivada', onUndo });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(screen.getByText('Iniciativa arquivada')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByText('Iniciativa arquivada')).not.toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('replaces the current toast and restarts the timer', () => {
    setup({ message: 'Primeiro', onUndo: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Outro' }));

    expect(screen.queryByText('Primeiro')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Desfazer' })).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Outro aviso')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('Outro aviso')).not.toBeInTheDocument();
  });

  it('pauses while the pointer is on the toast and resumes with the remaining time', () => {
    setup({ message: 'Iniciativa arquivada', onUndo: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    fireEvent.mouseEnter(screen.getByText('Iniciativa arquivada'));
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('Iniciativa arquivada')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByText('Iniciativa arquivada'));
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByText('Iniciativa arquivada')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Iniciativa arquivada')).not.toBeInTheDocument();
  });

  it('pauses while focus is inside the toast and resumes when it leaves', () => {
    setup({ message: 'Iniciativa arquivada', onUndo: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      screen.getByRole('button', { name: 'Desfazer' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('Iniciativa arquivada')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Outro' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Iniciativa arquivada')).not.toBeInTheDocument();
  });

  it('mentions the keyboard shortcut for screen readers', () => {
    setup({ message: 'Iniciativa arquivada', onUndo: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent(
      'Iniciativa arquivada (Ctrl+Z para desfazer)',
    );
  });

  it.each([
    ['ctrlKey', { ctrlKey: true }],
    ['metaKey', { metaKey: true }],
  ])('undoes with the %s + Z shortcut and closes', (_, modifier) => {
    const onUndo = vi.fn();
    setup({ message: 'Iniciativa arquivada', onUndo });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    fireEvent.keyDown(document.body, { key: 'z', ...modifier });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Iniciativa arquivada')).not.toBeInTheDocument();
  });

  it('ignores the shortcut when focus is in a text field or the keys do not match', () => {
    const onUndo = vi.fn();
    setup({ message: 'Iniciativa arquivada', onUndo });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    const field = document.createElement('input');
    document.body.append(field);

    fireEvent.keyDown(field, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'z' });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });

    expect(onUndo).not.toHaveBeenCalled();
    field.remove();
  });

  it('stops listening once the toast is gone', () => {
    const onUndo = vi.fn();
    setup({ message: 'Iniciativa arquivada', onUndo });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });

    expect(onUndo).not.toHaveBeenCalled();
  });

  it('throws outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Trigger options={{ message: 'x', onUndo: vi.fn() }} />)).toThrow(
      'useToast must be used inside a ToastProvider',
    );
  });
});

describe('Toast as a plain notice', () => {
  it('has no undo button or hint and ignores Ctrl+Z, but still goes away', () => {
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    setup({ message: 'Não foi possível desfazer.' });

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent(
      'Não foi possível desfazer.',
    );
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ctrl\+Z/)).not.toBeInTheDocument();
    expect(event.defaultPrevented).toBe(false);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Não foi possível desfazer.')).not.toBeInTheDocument();
    document.removeEventListener('keydown', outside);
  });
});
