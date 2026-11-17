import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers, createQueryClient } from './providers';

function Probe() {
  const options = useQueryClient().getDefaultOptions().queries;
  return <p>{String(options?.refetchOnWindowFocus)}</p>;
}

describe('Providers', () => {
  it('renders its children inside a query client', () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );

    expect(screen.getByText('false')).toBeInTheDocument();
  });
});

describe('createQueryClient', () => {
  it('turns retries off when asked, for tests', () => {
    expect(createQueryClient({ retry: false }).getDefaultOptions().queries?.retry).toBe(false);
  });

  it('retries once by default and never refetches on window focus', () => {
    const options = createQueryClient().getDefaultOptions().queries;

    expect(options?.retry).toBe(1);
    expect(options?.refetchOnWindowFocus).toBe(false);
  });
});
