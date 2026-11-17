import { useEffect, useState } from 'react';

const MIDNIGHT_MARGIN_MS = 1000;

// The current time, refreshed at each local midnight and when the tab comes back.
export function useClock(fixed?: Date): Date {
  const [current, setCurrent] = useState(() => new Date());

  useEffect(() => {
    if (fixed) return;
    let timer: ReturnType<typeof setTimeout>;
    function scheduleMidnight() {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(
        () => {
          setCurrent(new Date());
          scheduleMidnight();
        },
        midnight.getTime() - now.getTime() + MIDNIGHT_MARGIN_MS,
      );
    }
    function refresh() {
      if (document.visibilityState === 'visible') setCurrent(new Date());
    }
    scheduleMidnight();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fixed]);

  return fixed ?? current;
}
