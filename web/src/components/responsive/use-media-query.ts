import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';
export const BELOW_DESKTOP_QUERY = '(max-width: 1023px)';
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

// The server and the first hydration render are the desktop's; the data screens render after their
// client fetch, so the phone structure rarely shows a desktop frame first.
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
