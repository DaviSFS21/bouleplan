import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.closest('[hidden], [inert]') === null,
  );
}

// Keeps Tab inside the container. Events from portals (menus) are not the container's to trap.
export function trapTab(event: ReactKeyboardEvent, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return;
  if (!(event.target instanceof Node) || !container.contains(event.target)) return;
  const items = focusableIn(container);
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
