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

  it('keeps a local draft and reports the chosen date only on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value={null} onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.type(screen.getByLabelText('Prazo'), '2026-12-24');
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-12-24');
    expect(screen.queryByLabelText('Prazo')).not.toBeInTheDocument();
  });

  it('commits on Enter once and returns focus to the button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value={null} onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.type(screen.getByLabelText('Prazo'), '2026-12-24{Enter}');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-12-24');
    expect(screen.getByRole('button', { name: /^Prazo:/ })).toHaveFocus();
  });

  it('reverts with Escape without committing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.type(screen.getByLabelText('Prazo'), '2026-12-24{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Prazo: sex, 18 dez' })).toHaveFocus();
  });

  it('does not commit when blurred unchanged', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports null when the native input is cleared and blurred', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.clear(screen.getByLabelText('Prazo'));
    await user.tab();

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('discards an incomplete date on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    const input = screen.getByLabelText<HTMLInputElement>('Prazo');
    vi.spyOn(input, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState);

    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
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
