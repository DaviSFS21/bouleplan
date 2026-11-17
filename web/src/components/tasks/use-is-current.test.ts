import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIsCurrent } from './use-is-current';

describe('useIsCurrent', () => {
  it('is true for the shown id and false for another', () => {
    const { result } = renderHook(() => useIsCurrent('a'));
    expect(result.current('a')).toBe(true);
    expect(result.current('b')).toBe(false);
  });

  it('follows the id and keeps the same function', () => {
    const { result, rerender } = renderHook(({ id }) => useIsCurrent(id), {
      initialProps: { id: 'a' },
    });
    const first = result.current;

    rerender({ id: 'b' });

    expect(result.current).toBe(first);
    expect(result.current('a')).toBe(false);
    expect(result.current('b')).toBe(true);
  });

  it('is false for every id after unmount', () => {
    const { result, unmount } = renderHook(() => useIsCurrent('a'));
    unmount();
    expect(result.current('a')).toBe(false);
  });
});
