import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WeekField } from './week-field';

// Wednesday 2026-11-18, in the week that starts on Monday the 16th.
const NOW = new Date(2026, 10, 18, 10, 30);

async function openPicker(value: string | null, onChange = vi.fn()) {
  const user = userEvent.setup();
  render(<WeekField value={value} now={NOW} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: 'Escolher semana no calendário' }));
  return { user, onChange, dialog: screen.getByRole('dialog', { name: 'Escolher semana' }) };
}

describe('the week calendar', () => {
  it('shows the days of the chosen week marked, on its month', async () => {
    const { dialog } = await openPicker('2026-11-23');

    expect(within(dialog).getByText('novembro 2026')).toBeVisible();
    const marked = Array.from(dialog.querySelectorAll('td'))
      .filter((cell) => cell.className.includes('week'))
      .map((cell) => cell.getAttribute('data-day'));
    expect(marked).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
  });

  it('starts the grid on Monday and marks the week selected for assistive technology', async () => {
    const { dialog } = await openPicker('2026-11-18');

    const heads = Array.from(dialog.querySelectorAll('th')).map((head) => head.textContent);
    expect(heads).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    const selected = Array.from(dialog.querySelectorAll('td[aria-selected="true"]')).map((cell) =>
      cell.getAttribute('data-day'),
    );
    expect(selected).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('plans the week of any day that is clicked and returns focus to the button', async () => {
    const { user, onChange } = await openPicker(null);

    await user.click(screen.getByRole('button', { name: /sexta-feira, 20 de novembro/ }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-11-16');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher semana no calendário' })).toHaveFocus();
  });

  it('does not report the week that is already chosen', async () => {
    const { user, onChange } = await openPicker('2026-11-16');

    await user.click(screen.getByRole('button', { name: /terça-feira, 17 de novembro/ }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('plans this week with "Hoje"', async () => {
    const { user, onChange, dialog } = await openPicker('2026-12-07');

    await user.click(within(dialog).getByRole('button', { name: 'Hoje' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-11-16');
  });

  it('clears the week with "Limpar"', async () => {
    const { user, onChange, dialog } = await openPicker('2026-11-16');

    await user.click(within(dialog).getByRole('button', { name: 'Limpar' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('closes with Escape without choosing', async () => {
    const { user, onChange } = await openPicker('2026-11-16');

    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
