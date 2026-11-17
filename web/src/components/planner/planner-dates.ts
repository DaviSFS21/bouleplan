import { weekDates } from '@/components/tasks/task-week';

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

const LONG_WEEKDAYS = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
];

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function parts(iso: string): { day: number; month: number; offset: number } {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  // Days since Monday.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return { day, month: month - 1, offset: (date.getUTCDay() + 6) % 7 };
}

export function dayNumber(iso: string): number {
  return parts(iso).day;
}

function monthName(month: number): string {
  return MONTHS[month] ?? '';
}

export function weekTitle(weekStart: string): string {
  const first = parts(weekStart);
  const last = parts(weekDates(weekStart)[6] ?? weekStart);
  const end = `${String(last.day)} de ${monthName(last.month)}`;
  return first.month === last.month
    ? `${String(first.day)} a ${end}`
    : `${String(first.day)} de ${monthName(first.month)} a ${end}`;
}

export function dayRow(iso: string): string {
  const { day, month, offset } = parts(iso);
  return `${(WEEKDAYS[offset] ?? '').toLowerCase()}, ${String(day)} ${monthName(month).slice(0, 3)}`;
}

export function dayLabel(iso: string): string {
  const { day, month, offset } = parts(iso);
  return `${LONG_WEEKDAYS[offset] ?? ''}, ${String(day)} de ${monthName(month)}`;
}

export function deadlineWeekday(iso: string): string {
  return (WEEKDAYS[parts(iso).offset] ?? '').toLowerCase();
}
