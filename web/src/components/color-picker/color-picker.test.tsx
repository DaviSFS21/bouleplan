import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { COLOR_TOKENS, ColorPicker, colorName } from './color-picker';

const NAMES = ['Amarelo', 'Lima', 'Verde', 'Turquesa', 'Azul', 'Roxo', 'Rosa', 'Marrom'];

describe('colorName', () => {
  it('returns the pt-BR name of every token in palette order', () => {
    expect(COLOR_TOKENS.map(colorName)).toEqual(NAMES);
  });
});

describe('ColorPicker', () => {
  it('renders a labeled radiogroup with eight named swatches', () => {
    render(<ColorPicker label="Cor da iniciativa" value="verde" onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Cor da iniciativa' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual(
      NAMES,
    );
  });

  it('fills each swatch with its initiative token', () => {
    render(<ColorPicker label="Cor" value="verde" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Turquesa' })).toHaveStyle({
      '--swatch': 'var(--ini-turquesa)',
    });
  });

  it('checks only the current color and makes it the only tab stop', () => {
    render(<ColorPicker label="Cor" value="azul" onChange={vi.fn()} />);

    const checked = screen.getAllByRole('radio', { checked: true });
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName('Azul');
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toEqual(checked);
  });

  it('chooses on click', async () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Rosa' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('rosa');
  });

  it('chooses the focused swatch with Enter and Space', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Lima' }).focus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onChange).toHaveBeenNthCalledWith(1, 'lima');
    expect(onChange).toHaveBeenNthCalledWith(2, 'lima');
  });

  it.each([
    ['{ArrowRight}', 'Roxo'],
    ['{ArrowDown}', 'Roxo'],
    ['{ArrowLeft}', 'Turquesa'],
    ['{ArrowUp}', 'Turquesa'],
  ])('%s moves focus and the checked state without choosing', async (key, expected) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Azul' }).focus();

    await user.keyboard(key);

    expect(onChange).not.toHaveBeenCalled();
    const radio = screen.getByRole('radio', { name: expected });
    expect(radio).toHaveFocus();
    expect(radio).toBeChecked();
    expect(radio).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Azul' })).not.toBeChecked();
  });

  it('wraps around at both ends', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ColorPicker label="Cor" value="marrom" onChange={vi.fn()} />);
    screen.getByRole('radio', { name: 'Marrom' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Amarelo' })).toBeChecked();

    rerender(<ColorPicker label="Cor" value="amarelo" onChange={vi.fn()} />);
    screen.getByRole('radio', { name: 'Amarelo' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Marrom' })).toBeChecked();
  });

  it('reverts the selection and cancels on Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} onCancel={onCancel} />);
    screen.getByRole('radio', { name: 'Azul' }).focus();

    await user.keyboard('{ArrowRight}{Escape}');

    expect(screen.getByRole('radio', { name: 'Azul' })).toBeChecked();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('survives Escape without a cancel handler', async () => {
    const user = userEvent.setup();
    render(<ColorPicker label="Cor" value="azul" onChange={vi.fn()} />);
    screen.getByRole('radio', { name: 'Azul' }).focus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('radio', { name: 'Azul' })).toBeChecked();
  });

  it('follows a new value from outside', () => {
    const { rerender } = render(<ColorPicker label="Cor" value="azul" onChange={vi.fn()} />);

    rerender(<ColorPicker label="Cor" value="rosa" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Rosa' })).toBeChecked();
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Azul' }).focus();

    await user.keyboard('a');

    expect(onChange).not.toHaveBeenCalled();
  });
});
