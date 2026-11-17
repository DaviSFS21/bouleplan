import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMinuteClock } from './use-minute-clock';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 5, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMinuteClock', () => {
  it('moves forward each minute', () => {
    const { result } = renderHook(() => useMinuteClock());
    expect(result.current.getMinutes()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.getMinutes()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(result.current.getMinutes()).toBe(3);
  });

  it('refreshes when the tab becomes visible again', () => {
    const { result } = renderHook(() => useMinuteClock());
    vi.setSystemTime(new Date(2026, 10, 5, 10, 30));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.getMinutes()).toBe(30);
  });

  it('ignores the tab coming back while hidden', () => {
    const { result } = renderHook(() => useMinuteClock());
    vi.setSystemTime(new Date(2026, 10, 5, 10, 30));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.getMinutes()).toBe(0);
    visibility.mockRestore();
  });

  it('uses the fixed time and sets no timer', () => {
    const fixed = new Date(2026, 0, 1, 8, 15);
    const { result } = renderHook(() => useMinuteClock(fixed));

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(result.current).toBe(fixed);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops its timer on unmount', () => {
    const { unmount } = renderHook(() => useMinuteClock());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
