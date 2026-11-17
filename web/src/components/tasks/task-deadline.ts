import { formatDeadline, localToday } from '@/components/deadline-field/deadline-field';

export interface DeadlineLabel {
  text: string;
  alert: boolean;
}

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function deadlineLabel(deadline: string | null, now: Date, done: boolean): DeadlineLabel {
  if (deadline === null) return { text: 'sem prazo', alert: false };
  const today = localToday(now);
  const days = dayNumber(deadline) - dayNumber(today);
  const alert = days <= 1 && !done;
  if (days === 0) return { text: 'vence hoje', alert };
  if (days === 1) return { text: 'vence amanhã', alert };
  if (days === -1) return { text: 'venceu ontem', alert };
  const verb = days < 0 ? 'venceu' : 'vence';
  return { text: `${verb} ${formatDeadline(deadline, today)}`, alert };
}
