import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionField, type Flush } from './question-field';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

interface Setup {
  value?: string;
  readOnly?: boolean;
  locked?: boolean;
  error?: string | null;
  onSave?: (text: string) => Promise<boolean>;
}

function build({
  value = 'Texto salvo',
  readOnly = false,
  locked = false,
  error = null,
  onSave,
}: Setup = {}) {
  const save = onSave ?? vi.fn(() => Promise.resolve(true));
  const flushes = new Map<string, Flush>();
  const register = vi.fn((name: string, flush: Flush | null) => {
    if (flush) flushes.set(name, flush);
    else flushes.delete(name);
  });
  const element = (props: Setup = {}) => (
    <QuestionField
      name="went_well"
      prompt="O que foi bom?"
      value={props.value ?? value}
      readOnly={props.readOnly ?? readOnly}
      locked={props.locked ?? locked}
      error={props.error === undefined ? error : props.error}
      onSave={save}
      register={register}
    />
  );
  return { save, flushes, register, element };
}

function setup(options: Setup = {}) {
  const built = build(options);
  const user = userEvent.setup({ delay: null });
  const view = render(built.element());
  return {
    ...built,
    user,
    view,
    field: screen.getByRole('textbox', { name: 'O que foi bom?' }),
  };
}

describe('QuestionField', () => {
  it('uses the question as the label of the field', () => {
    const { field } = setup();

    expect(field).toHaveValue('Texto salvo');
    expect(screen.getByLabelText('O que foi bom?')).toBe(field);
  });

  it('invites a calm answer while the field is empty', () => {
    setup({ value: '' });

    expect(screen.getByPlaceholderText('Escreva com calma…')).toBe(
      screen.getByRole('textbox', { name: 'O que foi bom?' }),
    );
  });

  it('saves 800 ms after the last keystroke, not before', () => {
    // Timers that only move when the test moves them, so a slow machine cannot blur the 800 ms.
    vi.useFakeTimers();
    const { save, field } = setup();

    fireEvent.change(field, { target: { value: 'Texto salvo!' } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.change(field, { target: { value: 'Texto salvo!?' } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(save).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(save).toHaveBeenCalledExactlyOnceWith('Texto salvo!?');
  });

  it('saves on blur at once and does not save again when the timer fires', async () => {
    const { save, user, field } = setup();

    await user.type(field, '!');
    await user.tab();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(save).toHaveBeenCalledExactlyOnceWith('Texto salvo!');
  });

  it('sends only real changes: typing and undoing, or only spaces, saves nothing', async () => {
    const { save, user, field } = setup();

    await user.type(field, 'x{Backspace}');
    await user.tab();
    await user.click(field);
    await user.type(field, '   ');
    await user.tab();

    expect(save).not.toHaveBeenCalled();
  });

  it('trims what it sends', async () => {
    const { save, user, field } = setup();

    await user.type(field, ' fim  ');
    await user.tab();

    expect(save).toHaveBeenCalledExactlyOnceWith('Texto salvo fim');
  });

  it('does not send the same text twice, but tries again after a failure', async () => {
    const save = vi.fn(() => Promise.resolve(false));
    const { element } = build({ onSave: save });
    render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'b' } });
    fireEvent.blur(field);
    fireEvent.blur(field);
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.blur(field);

    expect(save).toHaveBeenCalledTimes(2);
    expect(field).toHaveValue('b');
  });

  it('keeps the typed text when a slow save fails after the user kept typing', async () => {
    let finish: (confirmed: boolean) => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { element } = build({ onSave: save });
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'um' } });
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: 'um dois' } });
    await act(async () => {
      finish(false);
      await Promise.resolve();
    });
    view.rerender(element({ error: 'Falhou' }));

    expect(field).toHaveValue('um dois');
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    expect(field).toHaveAttribute('aria-invalid', 'true');

    fireEvent.blur(field);
    expect(save).toHaveBeenLastCalledWith('um dois');
  });

  it('keeps newer text when an earlier save is confirmed late', async () => {
    let finish: (confirmed: boolean) => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { element } = build({ onSave: save });
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'um' } });
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: 'um dois' } });
    view.rerender(element({ value: 'um' }));
    await act(async () => {
      finish(true);
      await Promise.resolve();
    });

    expect(field).toHaveValue('um dois');
  });

  it('follows the saved text while it is clean, and not while it is dirty', () => {
    const { element } = build();
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    view.rerender(element({ value: 'Outro texto' }));
    expect(field).toHaveValue('Outro texto');

    fireEvent.change(field, { target: { value: 'Digitando' } });
    view.rerender(element({ value: 'Mais outro' }));
    expect(field).toHaveValue('Digitando');
  });

  it('saves what is waiting when it unmounts, including new text typed after a failure', async () => {
    const first = setup();
    await first.user.type(first.field, '!');
    first.view.unmount();
    expect(first.save).toHaveBeenCalledExactlyOnceWith('Texto salvo!');

    const failing = vi.fn(() => Promise.resolve(false));
    const second = build({ onSave: failing });
    const view = render(second.element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });
    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.blur(field);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(field, { target: { value: 'xy' } });
    fireEvent.change(field, { target: { value: 'xyz' } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(failing).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('tries once more on unmount a save that failed', async () => {
    const failing = vi.fn(() => Promise.resolve(false));
    const { element } = build({ onSave: failing });
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.blur(field);
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('keeps the spaces typed after an idle save whose trimmed text comes back', async () => {
    const { element, save } = build({ value: '' });
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'hello ' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('hello');
    view.rerender(element({ value: 'hello' }));
    fireEvent.change(field, { target: { value: 'hello world' } });

    expect(field).toHaveValue('hello world');
  });

  it('keeps the newlines typed after an idle save whose trimmed text comes back', async () => {
    const { element, save } = build({ value: '' });
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'line one\n\n' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('line one');
    view.rerender(element({ value: 'line one' }));

    expect(field).toHaveValue('line one\n\n');
  });

  it('still adopts a different saved text while it is clean', async () => {
    const { element } = build({ value: '' });
    const view = render(element());
    const field = screen.getByRole('textbox', { name: 'O que foi bom?' });

    fireEvent.change(field, { target: { value: 'hello ' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    view.rerender(element({ value: 'hello' }));
    view.rerender(element({ value: 'changed elsewhere' }));

    expect(field).toHaveValue('changed elsewhere');
  });

  it('sends what is pending, with keepalive, when the page is hidden or leaves', async () => {
    const { save, user, field } = setup();

    await user.type(field, '!');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('Texto salvo!', true);

    await user.type(field, '?');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(save).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(save).toHaveBeenLastCalledWith('Texto salvo!?', true);
  });

  it('is frozen while locked', () => {
    const { element } = build({ locked: true });
    render(element());

    expect(screen.getByRole('textbox', { name: 'O que foi bom?' })).toHaveAttribute('readonly');
  });

  it('registers a flush that saves at once and resolves with the confirmation', async () => {
    const { flushes, user, field, save } = setup();

    await user.type(field, '!');
    const flush = flushes.get('went_well');
    const result = await act(async () => flush?.());

    expect(result).toBe(true);
    expect(save).toHaveBeenCalledExactlyOnceWith('Texto salvo!');
    await expect(flushes.get('went_well')?.()).resolves.toBe(true);
  });

  it('resolves false from the flush when the save fails', async () => {
    const { flushes, user, field } = setup({ onSave: () => Promise.resolve(false) });

    await user.type(field, '!');
    const result = await act(async () => flushes.get('went_well')?.());

    expect(result).toBe(false);
  });

  it('waits for the save in flight when the flush is asked again', async () => {
    let finish: (confirmed: boolean) => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { flushes, user, field } = setup({ onSave: save });

    await user.type(field, '!');
    await user.tab();
    let settled = false;
    const waiting = flushes
      .get('went_well')?.()
      .then((confirmed) => {
        settled = confirmed;
      });
    await Promise.resolve();
    expect(settled).toBe(false);
    await act(async () => {
      finish(true);
      await waiting;
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(settled).toBe(true);
  });

  it('unregisters its flush when it unmounts', () => {
    const { flushes, view } = setup();

    expect(flushes.has('went_well')).toBe(true);
    view.unmount();

    expect(flushes.has('went_well')).toBe(false);
  });

  it('shows the answer as text, with no field, when it is read-only', () => {
    const { element } = build({ readOnly: true, value: 'Linha um\nLinha dois' });
    render(element());

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'O que foi bom?' });
    expect(group).toHaveTextContent('Linha um');
    expect(group).toHaveTextContent('Linha dois');
  });

  it('says there is no answer when a read-only answer is empty', () => {
    const { element } = build({ readOnly: true, value: '' });
    render(element());

    expect(screen.getByRole('group', { name: 'O que foi bom?' })).toHaveTextContent(
      'Sem resposta.',
    );
  });
});
