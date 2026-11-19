// Focus is lost on the page body, or on something already leaving (inert while it animates out).
export function focusIsLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || active.closest('[inert]') !== null;
}
