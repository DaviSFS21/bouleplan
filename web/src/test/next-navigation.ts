import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function navigateTo(url: string) {
  window.history.pushState(null, '', url);
  notify();
}

export function useSearchParams() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
  return new URLSearchParams(search);
}

export function usePathname() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  );
}

export function useRouter() {
  return {
    push: navigateTo,
    replace(url: string) {
      window.history.replaceState(null, '', url);
      notify();
    },
  };
}
