const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A roving or programmatic tabindex of -1 is not a tab stop.
const TAB_STOP = ':not([tabindex="-1"])';

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.closest('[hidden], [inert]') === null && element.matches(TAB_STOP),
  );
}

// Keeps Tab inside the container. Events from portals (menus) are not the container's to trap.
export function trapTab(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'target' | 'preventDefault'>,
  container: HTMLElement | null,
) {
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
