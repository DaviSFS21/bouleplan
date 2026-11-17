import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

// The current time, refreshed each minute and when the tab comes back.
export function useMinuteClock(fixed?: Date): Date {
  const [current, setCurrent] = useState(() => new Date());

  useEffect(() => {
    if (fixed) return;
    const timer = setInterval(() => {
      setCurrent(new Date());
    }, MINUTE_MS);
    function refresh() {
      if (document.visibilityState === 'visible') setCurrent(new Date());
    }
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fixed]);

  return fixed ?? current;
}
