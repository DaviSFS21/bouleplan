import { act, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useModalTarget, useRegisterModal } from './modal-host';

function Modal({ label }: Readonly<{ label: string }>) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useRegisterModal(node);
  return <div ref={setNode} role="dialog" aria-label={label} />;
}

describe('modal host', () => {
  it('has no target without an open modal', () => {
    const { result } = renderHook(() => useModalTarget());

    expect(result.current).toBeNull();
  });

  it('points at the innermost open modal and back as they close', () => {
    const { result } = renderHook(() => useModalTarget());
    const outer = render(<Modal label="Fora" />);
    expect(result.current).toBe(screen.getByRole('dialog', { name: 'Fora' }));

    const inner = render(<Modal label="Dentro" />);
    expect(result.current).toBe(screen.getByRole('dialog', { name: 'Dentro' }));

    act(() => {
      inner.unmount();
    });
    expect(result.current).toBe(screen.getByRole('dialog', { name: 'Fora' }));

    act(() => {
      outer.unmount();
    });
    expect(result.current).toBeNull();
  });
});
