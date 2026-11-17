import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { COLOR_TOKENS, ColorPicker, colorName, type ColorToken } from './color-picker';

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

  it('selects on click', async () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Rosa' }));

    expect(onChange).toHaveBeenCalledWith('rosa');
  });

  it('selects with Enter and Space', async () => {
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
    ['{ArrowRight}', 'roxo'],
    ['{ArrowDown}', 'roxo'],
    ['{ArrowLeft}', 'turquesa'],
    ['{ArrowUp}', 'turquesa'],
  ])('%s moves focus and selects', async (key, expected) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker label="Cor" value="azul" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Azul' }).focus();

    await user.keyboard(key);

    expect(onChange).toHaveBeenCalledWith(expected);
    expect(screen.getByRole('radio', { name: colorName(expected as ColorToken) })).toHaveFocus();
  });

  it('wraps around at both ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<ColorPicker label="Cor" value="marrom" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Marrom' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('amarelo');

    rerender(<ColorPicker label="Cor" value="amarelo" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Amarelo' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('marrom');
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
