import { useCallback, useEffect, useRef } from 'react';

// Tells an async continuation whether the component still shows that id.
export function useIsCurrent(id: string): (candidate: string) => boolean {
  const live = useRef({ mounted: true, id });

  useEffect(() => {
    live.current = { mounted: true, id };
    return () => {
      live.current.mounted = false;
    };
  }, [id]);

  return useCallback((candidate) => live.current.mounted && live.current.id === candidate, []);
}
