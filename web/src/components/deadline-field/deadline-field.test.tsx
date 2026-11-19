import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PHONE, setViewport } from '@/test/viewport';
import { DeadlineField, formatDeadline, localToday } from './deadline-field';

const TODAY = '2026-12-10';

describe('formatDeadline', () => {
  it('formats as weekday, day and short month in pt-BR without dots', () => {
    expect(formatDeadline('2026-12-18')).toBe('sex, 18 dez');
    expect(formatDeadline('2027-01-05', '2027-06-01')).toBe('ter, 5 jan');
  });

  it('adds the year when it is not the current year', () => {
    expect(formatDeadline('2099-12-18', '2026-11-17')).toBe('sex, 18 dez 2099');
    expect(formatDeadline('2025-12-19', '2026-11-17')).toBe('sex, 19 dez 2025');
  });

  it('keeps the weekday of the first years, which Date would map to the 1900s', () => {
    expect(formatDeadline('0001-01-15', '2026-11-17')).toBe('seg, 15 jan 1');
  });

  it('defaults to the real current date', () => {
    expect(formatDeadline('2099-12-18')).toBe('sex, 18 dez 2099');
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

  it('opens a calendar on the month of the value, with the day marked', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    const dialog = screen.getByRole('dialog', { name: 'Escolher prazo' });
    expect(within(dialog).getByText('dezembro 2026')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: /^sexta-feira, 18 de dezembro/ }).parentElement,
    ).toHaveAttribute('data-selected', 'true');
    expect(
      within(dialog).getByRole('button', { name: /quinta-feira, 10 de dezembro/ }).parentElement,
    ).toHaveAttribute('data-today', 'true');
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('writes the weekdays as initials, starting on Sunday', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value={null} onChange={vi.fn()} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    const initials = within(screen.getByRole('dialog')).getAllByRole('columnheader', {
      hidden: true,
    });
    expect(initials.map((cell) => cell.textContent)).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
  });

  it('reports the day that is clicked, closes and returns focus to the button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value={null} onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.click(screen.getByRole('button', { name: /^terça-feira, 15 de dezembro/ }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-12-15');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Prazo:/ })).toHaveFocus();
  });

  it('does not report the day that is already the deadline', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.click(screen.getByRole('button', { name: /^sexta-feira, 18 de dezembro/ }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves between months with the arrows', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.click(screen.getByRole('button', { name: 'Ir para o próximo mês' }));
    expect(screen.getByText('janeiro 2027')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ir para o mês anterior' }));
    await user.click(screen.getByRole('button', { name: 'Ir para o mês anterior' }));
    expect(screen.getByText('novembro 2026')).toBeVisible();
  });

  it('chooses today with "Hoje"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(TODAY);
  });

  it('clears with "Limpar", which is off when there is no deadline', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<DeadlineField value={null} onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled();
    unmount();

    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    await user.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts on the selected day, walks the grid with the keys and chooses with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    expect(screen.getByRole('button', { name: /^sexta-feira, 18 de dezembro/ })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /^sábado, 19 de dezembro/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^sábado, 26 de dezembro/ })).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(screen.getByText('janeiro 2027')).toBeVisible();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2027-01-26');
    expect(screen.getByRole('button', { name: /^Prazo:/ })).toHaveFocus();
  });

  it('starts on today when there is no deadline', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value={null} onChange={vi.fn()} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    expect(screen.getByRole('button', { name: /quinta-feira, 10 de dezembro/ })).toHaveFocus();
  });

  it('closes with Escape without choosing, and returns focus to the button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prazo: sex, 18 dez' })).toHaveFocus();
  });

  it('closes on a press outside and when the button is pressed again', async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Fora</p>
        <DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    await user.click(screen.getByText('Fora'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a sheet on a phone', async () => {
    setViewport(PHONE);
    const user = userEvent.setup();
    render(<DeadlineField value="2026-12-18" onChange={vi.fn()} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    expect(screen.getByRole('dialog', { name: 'Escolher prazo' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('explains a value outside years 1 to 9999', async () => {
    const user = userEvent.setup();
    render(<DeadlineField value="10000-01-01" onChange={vi.fn()} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma data entre os anos 1 e 9999.');
  });

  it('stops the months at year 1 and year 9999', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DeadlineField value="0001-01-15" onChange={vi.fn()} today={TODAY} />,
    );
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    expect(screen.getByRole('button', { name: 'Ir para o mês anterior' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    unmount();

    render(<DeadlineField value="9999-12-15" onChange={vi.fn()} today={TODAY} />);
    await user.click(screen.getByRole('button', { name: /^Prazo:/ }));
    expect(screen.getByRole('button', { name: 'Ir para o próximo mês' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('clears the deadline with "Remover prazo", leaving focus on the button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeadlineField value="2026-12-18" onChange={onChange} today={TODAY} />);

    await user.click(screen.getByRole('button', { name: 'Remover prazo' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.getByRole('button', { name: /^Prazo:/ })).toHaveFocus();
  });
});

describe('DeadlineField with a display override', () => {
  it('shows the given wording with the alert style and no "vencido" badge', () => {
    render(
      <DeadlineField
        value="2026-12-09"
        onChange={vi.fn()}
        today={TODAY}
        display={{ text: 'venceu ontem', alert: true }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Prazo: venceu ontem' });
    expect(button).toHaveTextContent('venceu ontem');
    expect(button).not.toHaveTextContent('vencido');
    expect(button.className).toContain('overdue');
  });

  it('does not alert when the display says so, even if the date is past', () => {
    render(
      <DeadlineField
        value="2026-12-01"
        onChange={vi.fn()}
        today={TODAY}
        display={{ text: 'venceu qua, 1 dez', alert: false }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Prazo: venceu qua, 1 dez' }).className,
    ).not.toContain('overdue');
  });
});
