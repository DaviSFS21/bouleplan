let cancelling = false;

export function isCancellingEdit(): boolean {
  return cancelling;
}

export const CANCEL_ON_DISMISS = { 'data-cancel-on-dismiss': '' } as const;

// Dismissing by tap or drag cancels marked drafts and blurs the rest, so pending saves flush.
export function cancelEditing(within: HTMLElement | null) {
  const active = document.activeElement;
  const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  if (!typing || within?.contains(active) !== true) return;
  if (!active.hasAttribute('data-cancel-on-dismiss')) {
    active.blur();
    return;
  }
  cancelling = true;
  try {
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  } finally {
    cancelling = false;
  }
}
