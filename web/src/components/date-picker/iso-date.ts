export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;

const ISO = /^(\d+)-(\d{2})-(\d{2})$/;

// Calendar days live at local noon so a daylight-saving shift never moves them.
export function atNoon(year: number, month: number, day: number): Date {
  const date = new Date(2000, month, day, 12);
  date.setFullYear(year, month, day);
  return date;
}

export function inRange(year: number): boolean {
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

// null for text that is not a real day of years 1 to 9999.
export function parseIso(iso: string): Date | null {
  const match = ISO.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  if (!inRange(year)) return null;
  const date = atNoon(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

export function firstMonth(): Date {
  return atNoon(MIN_YEAR, 0, 1);
}

export function lastMonth(): Date {
  return atNoon(MAX_YEAR, 11, 1);
}
