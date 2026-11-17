import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusStrip } from './status-strip';

describe('StatusStrip', () => {
  it('announces a notice politely with its title and text', () => {
    render(
      <StatusStrip tone="atencao" title="Prazos sem tempo reservado.">
        2 tarefas vencem nesta semana.
      </StatusStrip>,
    );

    const strip = screen.getByRole('status');
    expect(strip).toHaveTextContent('Prazos sem tempo reservado. 2 tarefas vencem nesta semana.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('interrupts for an error', () => {
    render(
      <StatusStrip tone="erro" title="Não salvou.">
        Tente de novo.
      </StatusStrip>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Não salvou. Tente de novo.');
  });

  it.each(['sucesso', 'info'] as const)('renders the %s tone', (tone) => {
    render(
      <StatusStrip tone={tone} title="Pronto.">
        Texto
      </StatusStrip>,
    );

    expect(screen.getByRole('status')).toBeVisible();
  });

  it('runs the action', async () => {
    const onClick = vi.fn();
    render(
      <StatusStrip tone="atencao" title="T." action={{ label: 'Mostrar', onClick }}>
        Texto
      </StatusStrip>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
