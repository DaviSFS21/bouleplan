import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('writes the count next to a labelled progressbar', () => {
    render(<ProgressBar label="Progresso de Reforma" done={3} total={8} />);

    const bar = screen.getByRole('progressbar', { name: 'Progresso de Reforma' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(screen.getByText('3 de 8 feitas')).toBeVisible();
  });

  it('fills the track by the done share and keeps the same color at 100%', () => {
    render(<ProgressBar label="x" done={8} total={8} />);

    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('says there are no tasks instead of drawing an empty bar', () => {
    render(<ProgressBar label="x" done={0} total={0} />);

    expect(screen.getByText('sem tarefas ainda')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
