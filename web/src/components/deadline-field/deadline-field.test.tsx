import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeadlineField, formatDeadline, localToday } from './deadline-field';

const TODAY = '2026-12-10';

describe('formatDeadline', () => {
  it('formats as weekday, day and short month in pt-BR without dots', () => {
    expect(formatDeadline('2026-12-18')).toBe('sex, 18 dez');
    expect(formatDeadline('2027-01-05')).toBe('ter, 5 jan');
  });
});

describe('localToday', () => {
  it('uses the local calendar date with zero padding', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('defaults to the current date', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('DeadlineField', () => {
  it('shows "sem prazo" and no remove action when empty', () => {
    render(<DeadlineField value={null} onChange={vi.fn()} today={TODAY} />);

    expect(screen.getByRole('button', { name: 'Prazo: sem prazo' })).toHaveTextContent('sem prazo');
    expect(screen.queryByRole('button', { name: 'Remover prazo' })).not.toBeInTheDocument();
  });

  it('shows a future date without the overdue marker', () => {
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);

    const button = screen.getByRole('button', { name: 'Prazo: sex, 18 dez' });
    expect(button).toHaveTextContent('sex, 18 dez');
    expect(button).not.toHaveTextContent('vencido');
  });

  it('treats today as not overdue', () => {
    render(<DeadlineField value={TODAY} onChange={vi.fn()} today={TODAY} />);

    expect(screen.getByRole('button', { name: /^Prazo:/ })).not.toHaveTextContent('vencido');
  });

  it('marks a past date as overdue with text, not color alone', () => {
    render(<DeadlineField value="2026-12-09" onChange={vi.fn()} today={TODAY} />);

    const button = screen.getByRole('button', { name: 'Prazo: qua, 9 dez, vencido' });
    expect(button).toHaveTextContent('· vencido');
  });

  it('uses the custom label and the real date by default', () => {
    render(<DeadlineField label="Prazo geral" value="2000-01-01" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^Prazo geral: .*vencido$/ })).toBeInTheDocument();
  });

  it('reveals a native date input with the current value and focuses it', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    const input = screen.getByLabelText('Prazo');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-12-18');
    expect(input).toHaveFocus();
  });

  it('reports a chosen date as ISO', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value={null} onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.type(screen.getByLabelText('Prazo'), '2026-12-24');

    expect(onChange).toHaveBeenLastCalledWith('2026-12-24');
  });

  it('reports null when the native input is cleared', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.clear(screen.getByLabelText('Prazo'));

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('closes the input on blur', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.click(document.body);

    expect(screen.queryByLabelText('Prazo')).not.toBeInTheDocument();
  });

  it.each(['{Escape}', '{Enter}'])('closes the input with %s and returns focus', async (key) => {
    const user = userEvent.setup();
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.keyboard(key);

    expect(screen.queryByLabelText('Prazo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Prazo:/ })).toHaveFocus();
  });

  it('ignores other keys while editing', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.keyboard('{ArrowUp}');

    expect(screen.getByLabelText('Prazo')).toBeInTheDocument();
  });

  it('clears the deadline with "Remover prazo"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: 'Remover prazo' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });
});
