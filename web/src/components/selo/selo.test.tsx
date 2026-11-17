import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockedSelo, PrioritySelo, seloClassName } from './selo';

describe('selo', () => {
  it('writes the priority in the badge, so color is never the only signal', () => {
    render(<PrioritySelo priority="P1" />);

    expect(screen.getByText('P1')).toBeVisible();
  });

  it('gives each priority its own class', () => {
    const classes = new Set((['P1', 'P2', 'P3'] as const).map(seloClassName));

    expect(classes.size).toBe(3);
  });

  it('names the blocked situation next to a hidden lock icon', () => {
    const { container } = render(<BlockedSelo />);

    expect(screen.getByText('Bloqueada')).toBeVisible();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
