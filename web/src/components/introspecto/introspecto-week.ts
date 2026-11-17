import { localToday } from '@/components/deadline-field/deadline-field';
import { currentWeekStart, stepWeek, weekStartOf } from '@/components/tasks/task-week';

const SUNDAY = 0;
const FRIDAY = 5;

// From Friday to Sunday the review is about the current week; earlier, about the week that just ended.
export function defaultReviewWeek(now: Date): string {
  const current = currentWeekStart(now);
  const day = now.getDay();
  return day === SUNDAY || day >= FRIDAY ? current : (stepWeek(current, -1) ?? current);
}

export function isWeekStart(value: string | null): value is string {
  return (
    value !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1 &&
    weekStartOf(value) === value
  );
}

export function weekOfInstant(timestamp: string): string {
  return weekStartOf(localToday(new Date(timestamp)));
}
