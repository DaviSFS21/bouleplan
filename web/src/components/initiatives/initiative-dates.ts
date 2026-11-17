const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const RELATIVE = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RELATIVE_DAYS_LIMIT = 7;

function withoutDots(text: string): string {
  return text.replaceAll('.', '').replaceAll(' de ', ' ');
}

export function formatDate(iso: string, now: Date): string {
  const date = new Date(iso);
  const format = date.getFullYear() === now.getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR;
  return withoutDots(format.format(date));
}

export function formatElapsed(iso: string, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (elapsed < MINUTE) return withoutDots(RELATIVE.format(0, 'second'));
  if (elapsed < HOUR) return withoutDots(RELATIVE.format(-Math.floor(elapsed / MINUTE), 'minute'));
  if (elapsed < DAY) return withoutDots(RELATIVE.format(-Math.floor(elapsed / HOUR), 'hour'));
  const days = Math.floor(elapsed / DAY);
  if (days < RELATIVE_DAYS_LIMIT) return withoutDots(RELATIVE.format(-days, 'day'));
  return `em ${formatDate(iso, now)}`;
}
