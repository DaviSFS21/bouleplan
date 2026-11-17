import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClock } from './use-clock';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 5, 23, 59, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useClock', () => {
  it('moves to the next day at local midnight', () => {
    const { result } = renderHook(() => useClock());
    expect(result.current.getDate()).toBe(5);

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(result.current.getDate()).toBe(6);
  });

  it('keeps counting midnights', () => {
    const { result } = renderHook(() => useClock());

    act(() => {
      vi.advanceTimersByTime(2 * 24 * 3_600_000);
    });

    expect(result.current.getDate()).toBe(7);
  });

  it('refreshes when the tab becomes visible again', () => {
    const { result } = renderHook(() => useClock());
    vi.setSystemTime(new Date(2026, 10, 6, 9));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.getDate()).toBe(6);
  });

  it('does not refresh a hidden tab', () => {
    const { result } = renderHook(() => useClock());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.setSystemTime(new Date(2026, 10, 6, 9));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.getDate()).toBe(5);
  });

  it('stays on a fixed time and sets no timer', () => {
    const fixed = new Date(2026, 0, 1);
    const { result } = renderHook(() => useClock(fixed));

    act(() => {
      vi.advanceTimersByTime(48 * 3_600_000);
    });

    expect(result.current).toBe(fixed);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timer on unmount', () => {
    const { unmount } = renderHook(() => useClock());

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
