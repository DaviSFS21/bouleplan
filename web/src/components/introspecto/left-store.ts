const PREFIX = 'bouleplan.introspecto.leftBehind.';

// What was left behind cannot be told from the tasks once planned, so each device remembers it.
export function loadLeft(weekStart: string, taskIds: ReadonlySet<string>): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PREFIX + weekStart) ?? '[]');
    return new Set(
      Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === 'string' && taskIds.has(id))
        : [],
    );
  } catch {
    return new Set();
  }
}

export function saveLeft(weekStart: string, ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(PREFIX + weekStart, JSON.stringify([...ids]));
  } catch {
    // Storage may be blocked; the sheet then forgets on reload.
  }
}
