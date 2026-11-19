import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cancelEditing } from './cancel-editing';
import { useModalKeys } from './use-modal-keys';

function Dialog({ onEscape }: Readonly<{ onEscape: () => void }>) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useModalKeys(node, { onEscape, trap: false });
  return (
    <div role="dialog" aria-label="Caixa" ref={setNode}>
      <input aria-label="Campo" />
    </div>
  );
}

describe('cancelEditing', () => {
  it('sends Escape to the field being typed in without closing the modal', () => {
    const onEscape = vi.fn();
    const onKey = vi.fn();
    render(<Dialog onEscape={onEscape} />);
    const dialog = screen.getByRole('dialog');
    const field = screen.getByRole('textbox');
    field.addEventListener('keydown', (event) => {
      onKey(event.key);
    });
    field.focus();

    cancelEditing(dialog);

    expect(onKey).toHaveBeenCalledWith('Escape');
    expect(onEscape).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no field inside is focused', () => {
    render(<Dialog onEscape={vi.fn()} />);
    const onKey = vi.fn();
    document.addEventListener('keydown', onKey);

    cancelEditing(screen.getByRole('dialog'));

    expect(onKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onKey);
  });
});
