let cancelling = false;

export function isCancellingEdit(): boolean {
  return cancelling;
}

// Leaving a dialog by tap or drag cancels the field being typed in, as Escape does. The Escape is
// synthetic, so the modal's own Escape handler must not take it as a request to close.
export function cancelEditing(within: HTMLElement | null) {
  const active = document.activeElement;
  const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  if (!typing || within?.contains(active) !== true) return;
  cancelling = true;
  try {
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  } finally {
    cancelling = false;
  }
}
