import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Loading } from './loading';

describe('Loading', () => {
  it('is an image labelled "Carregando"', () => {
    render(<Loading />);

    expect(screen.getByRole('img', { name: 'Carregando' })).toBeInTheDocument();
  });

  it('is 40px by default and accepts another size', () => {
    const { rerender } = render(<Loading />);
    expect(screen.getByRole('img')).toHaveAttribute('width', '40');

    rerender(<Loading size={96} />);
    expect(screen.getByRole('img')).toHaveAttribute('height', '96');
  });
});
