import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DescriptionField } from './description-field';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(value = 'Texto salvo', error?: string) {
  const onSave = vi.fn();
  const user = userEvent.setup({ delay: null });
  const view = render(<DescriptionField value={value} onSave={onSave} error={error} />);
  return { onSave, user, view, field: screen.getByRole('textbox', { name: 'Descrição' }) };
}

describe('DescriptionField autosave', () => {
  it('saves 800 ms after the last keystroke, not before', async () => {
    const { onSave, user, field } = setup();

    await user.type(field, '!');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).not.toHaveBeenCalled();
    await user.type(field, '?');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Texto salvo!?');
  });

  it('saves on blur at once and does not save again when the timer fires', async () => {
    const { onSave, user, field } = setup();

    await user.type(field, '!');
    await user.tab();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Texto salvo!');
  });

  it('trims the text it saves and saves nothing when only spaces were added', async () => {
    const { onSave, user, field } = setup();

    await user.type(field, '   ');
    await user.tab();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(field, ' fim  ');
    await user.tab();
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Texto salvo    fim');
  });

  it('reverts unsaved text on Esc, cancels the timer and keeps Esc from the panel', async () => {
    const onKey = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <div onKeyDown={onKey}>
        <DescriptionField value="Texto salvo" onSave={onSave} />
      </div>,
    );
    const field = screen.getByRole('textbox', { name: 'Descrição' });

    await user.type(field, ' mais');
    onKey.mockClear();
    await user.keyboard('{Escape}');
    expect(onKey).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    await user.tab();

    expect(field).toHaveValue('Texto salvo');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves what is waiting when it unmounts, but not what failed', async () => {
    const first = setup();
    await first.user.type(first.field, '!');
    first.view.unmount();
    expect(first.onSave).toHaveBeenCalledExactlyOnceWith('Texto salvo!');

    const second = setup('Texto salvo', 'Não foi possível salvar a descrição. Tente de novo.');
    await second.user.type(second.field, '!');
    second.view.unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(second.onSave).not.toHaveBeenCalled();
  });

  it('does not send the same text twice, but tries again after an error', () => {
    const onSave = vi.fn();
    const { rerender } = render(<DescriptionField value="a" onSave={onSave} />);
    const field = screen.getByRole('textbox', { name: 'Descrição' });

    fireEvent.change(field, { target: { value: 'b' } });
    fireEvent.blur(field);
    fireEvent.blur(field);
    expect(onSave).toHaveBeenCalledTimes(1);

    rerender(<DescriptionField value="a" onSave={onSave} error="Falhou" />);
    fireEvent.blur(field);

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('grows with its content', () => {
    const { field } = setup();
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 120 });

    fireEvent.change(field, { target: { value: 'uma\nduas\ntrês\nquatro' } });

    expect(field.style.height).toBe('120px');
  });

  it('follows a newer saved text while clean, so a blur without typing saves nothing', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup({ delay: null });
    const view = render(<DescriptionField value="velho" onSave={onSave} />);

    view.rerender(<DescriptionField value="novo de fora" onSave={onSave} />);
    const field = screen.getByRole('textbox', { name: 'Descrição' });
    expect(field).toHaveValue('novo de fora');
    await user.click(field);
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps typed text when the saved text changes, and becomes clean once it matches', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup({ delay: null });
    const view = render(<DescriptionField value="a" onSave={onSave} />);
    const field = screen.getByRole('textbox', { name: 'Descrição' });

    await user.type(field, 'b');
    view.rerender(<DescriptionField value="outro" onSave={onSave} />);
    expect(field).toHaveValue('ab');
    view.rerender(<DescriptionField value="ab" onSave={onSave} />);
    view.rerender(<DescriptionField value="c" onSave={onSave} />);

    expect(field).toHaveValue('c');
  });

  it('leaves Esc to the panel when there is nothing to revert, and while composing', async () => {
    const onKey = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <div onKeyDown={onKey}>
        <DescriptionField value="salvo" onSave={vi.fn()} />
      </div>,
    );
    const field = screen.getByRole('textbox', { name: 'Descrição' });
    await user.click(field);

    await user.keyboard('{Escape}');
    expect(onKey).toHaveBeenCalledTimes(1);

    await user.type(field, ' mais');
    fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
    expect(field).toHaveValue('salvo mais');
  });

  it('asks to clear the error when Esc reverts', async () => {
    const onRevert = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<DescriptionField value="salvo" onSave={vi.fn()} onRevert={onRevert} error="Falhou" />);
    const field = screen.getByRole('textbox', { name: 'Descrição' });

    await user.type(field, ' x');
    await user.keyboard('{Escape}');

    expect(onRevert).toHaveBeenCalledOnce();
    expect(field).toHaveValue('salvo');
  });
});
