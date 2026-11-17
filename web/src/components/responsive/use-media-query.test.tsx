import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PHONE, TABLET, setViewport } from '@/test/viewport';
import { useIsBelowDesktop, useIsCoarsePointer, useIsPhone } from './use-media-query';

function Probe() {
  return <p>{[useIsPhone(), useIsBelowDesktop(), useIsCoarsePointer()].map(String).join(' ')}</p>;
}

describe('media query hooks', () => {
  it('describe the desktop when matchMedia is missing', () => {
    render(<Probe />);

    expect(screen.getByText('false false false')).toBeInTheDocument();
  });

  it('follow the phone, below-desktop and coarse-pointer queries', () => {
    setViewport(PHONE);
    render(<Probe />);

    expect(screen.getByText('true true true')).toBeInTheDocument();
  });

  it('tell a tablet from a phone and a desktop', () => {
    setViewport(TABLET);
    render(<Probe />);

    expect(screen.getByText('false true true')).toBeInTheDocument();
  });

  it('update when the viewport changes', () => {
    setViewport({ width: 1440 });
    render(<Probe />);
    expect(screen.getByText('false false false')).toBeInTheDocument();

    setViewport(PHONE);

    expect(screen.getByText('true true true')).toBeInTheDocument();
  });

  it('describe the desktop on the server, whatever the viewport', () => {
    setViewport(PHONE);

    expect(renderToString(<Probe />)).toContain('false false false');
  });
});
