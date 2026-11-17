const STORAGE_KEY = 'bouleplan.quick-task-initiative';

export function rememberedInitiativeId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberInitiativeId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Remembering is a convenience: private windows and blocked storage just forget.
  }
}
