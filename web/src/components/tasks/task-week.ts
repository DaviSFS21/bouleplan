const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fromIso(iso: string): Date {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function toIso(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Days since Monday.
function weekday(date: Date): number {
  return (date.getUTCDay() + 6) % WEEK_DAYS;
}

export function isoWeekNumber(iso: string): number {
  const date = fromIso(iso);
  const thursday = addDays(date, 3 - weekday(date));
  const yearStart = new Date(0);
  yearStart.setUTCFullYear(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart.getTime()) / DAY_MS / WEEK_DAYS) + 1;
}

export function currentWeekStart(now: Date): string {
  const today = new Date(0);
  today.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  return toIso(addDays(today, -weekday(today)));
}

export function weekStartOf(iso: string): string {
  const date = fromIso(iso);
  return toIso(addDays(date, -weekday(date)));
}

export function weekDates(weekStart: string): string[] {
  const first = fromIso(weekStart);
  return Array.from({ length: WEEK_DAYS }, (_, offset) => toIso(addDays(first, offset)));
}

export function stepWeek(weekStart: string, weeks: number): string | null {
  const moved = addDays(fromIso(weekStart), weeks * WEEK_DAYS);
  const year = moved.getUTCFullYear();
  return year < MIN_YEAR || year > MAX_YEAR ? null : toIso(moved);
}

export function weekText(weekStart: string | null): string {
  return weekStart === null
    ? 'Não planejada'
    : `Planejada na semana ${String(isoWeekNumber(weekStart))}`;
}

export function weekRange(weekStart: string): string {
  const first = fromIso(weekStart);
  const last = addDays(first, WEEK_DAYS - 1);
  const firstMonth = MONTHS[first.getUTCMonth()] ?? '';
  const lastMonth = MONTHS[last.getUTCMonth()] ?? '';
  const start = String(first.getUTCDate());
  const end = String(last.getUTCDate());
  return firstMonth === lastMonth
    ? `${start} a ${end} ${lastMonth}`
    : `${start} ${firstMonth} a ${end} ${lastMonth}`;
}
