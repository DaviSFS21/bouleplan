import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';
export const BELOW_DESKTOP_QUERY = '(max-width: 1023px)';
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

// Without matchMedia (server, old test environments) the page is the desktop one.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => {
        list.removeEventListener('change', notify);
      };
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

export function useIsBelowDesktop(): boolean {
  return useMediaQuery(BELOW_DESKTOP_QUERY);
}

export function useIsCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}
