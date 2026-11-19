import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineText } from './inline-text';

describe('InlineText single line', () => {
  it('renders a labeled text input with the value and maxLength', () => {
    render(<InlineText label="Nome" value="Reforma" maxLength={200} onCommit={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Nome' });
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveValue('Reforma');
    expect(input).toHaveAttribute('maxlength', '200');
  });

  it('commits a changed value on blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineText label="Nome" value="Reforma" onCommit={onCommit} />);

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), ' da casa');
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Reforma da casa');
  });

  it('commits on Enter and leaves the field', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineText label="Nome" value="Reforma" onCommit={onCommit} />);

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), ' X{Enter}');

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Reforma X');
    expect(screen.getByRole('textbox', { name: 'Nome' })).not.toHaveFocus();
  });

  it('does not commit when the value is unchanged', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineText label="Nome" value="Reforma" onCommit={onCommit} />);

    await user.click(screen.getByRole('textbox', { name: 'Nome' }));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reverts to the saved value on Escape without committing', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineText label="Nome" value="Reforma" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Nome' });

    await user.type(input, ' X{Escape}');

    expect(input).toHaveValue('Reforma');
    expect(input).not.toHaveFocus();
    expect(onCommit).not.toHaveBeenCalled();

    await user.type(input, 'Y');
    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('ReformaY');
  });

  it('stops Escape from reaching ancestors', async () => {
    const user = userEvent.setup();
    const onAncestorKeyDown = vi.fn();
    render(
      <div onKeyDown={onAncestorKeyDown}>
        <InlineText label="Nome" value="Reforma" onCommit={vi.fn()} />
      </div>,
    );
    await user.click(screen.getByRole('textbox', { name: 'Nome' }));
    onAncestorKeyDown.mockClear();

    await user.keyboard('{Escape}');

    expect(onAncestorKeyDown).not.toHaveBeenCalled();
  });

  it('follows a new saved value', () => {
    const { rerender } = render(<InlineText label="Nome" value="Reforma" onCommit={vi.fn()} />);

    rerender(<InlineText label="Nome" value="Horta" onCommit={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Horta');
  });

  it('shows an error linked to the field', () => {
    render(
      <InlineText
        label="Nome"
        value=""
        error="O nome não pode ficar em branco"
        onCommit={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Nome' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('O nome não pode ficar em branco');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('O nome não pode ficar em branco');
    expect(alert).toBeInTheDocument();
  });

  it('has no alert or invalid state without an error', () => {
    render(<InlineText label="Nome" value="Reforma" onCommit={vi.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome' })).not.toHaveAttribute('aria-invalid');
  });
});

describe('InlineText multiline', () => {
  it('renders a textarea where Enter adds a line and does not commit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <InlineText
        label="Descrição"
        value=""
        multiline
        placeholder="Descreva"
        onCommit={onCommit}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Descrição' });

    await user.type(field, 'a{Enter}b');

    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveValue('a\nb');
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('a\nb');
  });
});

describe('InlineText validation and focus', () => {
  it('shows the validation message, reverts the field and does not commit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const validate = (text: string) => (text.trim() === '' ? 'Dê um nome à iniciativa.' : null);
    render(<InlineText label="Nome" value="Reforma" validate={validate} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Nome' });

    await user.clear(input);
    await user.tab();

    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome à iniciativa.');
    expect(input).toHaveValue('Reforma');
    expect(onCommit).not.toHaveBeenCalled();

    await user.type(input, 'X');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the validation message on Escape', async () => {
    const user = userEvent.setup();
    const validate = (text: string) => (text === '' ? 'Obrigatório' : null);
    render(<InlineText label="Nome" value="Reforma" validate={validate} onCommit={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Nome' });
    await user.clear(input);
    await user.tab();

    await user.click(input);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('focuses and selects the field when the focus signal changes', () => {
    const { rerender } = render(
      <InlineText label="Nome" value="Reforma" onCommit={vi.fn()} focusSignal={0} />,
    );
    const input = screen.getByRole('textbox', { name: 'Nome' });
    expect(input).not.toHaveFocus();

    rerender(<InlineText label="Nome" value="Reforma" onCommit={vi.fn()} focusSignal={1} />);

    expect(input).toHaveFocus();
  });
});

describe('InlineText trim', () => {
  it('commits and shows the trimmed value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineText label="Nome" value="Reforma" trim onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Nome' });

    await user.clear(input);
    await user.type(input, '  Casa nova  ');
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Casa nova');
    expect(input).toHaveValue('Casa nova');
  });

  it('does not commit when the trimmed value equals the saved one, and tidies the field', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineText label="Nome" value="Reforma" trim onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Nome' });

    await user.type(input, '   ');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('Reforma');
  });

  it('is dismissed by blurring, not cancelled, unlike a single-line title', () => {
    render(
      <>
        <InlineText label="Descrição" value="" multiline onCommit={vi.fn()} />
        <InlineText label="Nome" value="" onCommit={vi.fn()} />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Descrição' })).not.toHaveAttribute(
      'data-cancel-on-dismiss',
    );
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveAttribute('data-cancel-on-dismiss');
  });
});
