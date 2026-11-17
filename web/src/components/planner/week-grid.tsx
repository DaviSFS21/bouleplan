'use client';

import type { CalendarEvent } from '@/api/types';
import { DayColumn, type Draft } from './day-column';
import { DayStrip } from './day-strip';
import { dayNumber, WEEKDAYS } from './planner-dates';
import type { DragData, Preview } from './planner-drop';
import { pixelsFromMinutes } from './planner-geometry';
import type { BlockModel, DayModel, EntryModel } from './planner-model';
import styles from './week-grid.module.css';

interface WeekGridProps {
  label: string;
  today: string;
  // Minutes into today, when today is in the week.
  nowMinutes: number | null;
  days: readonly DayModel[];
  startHour: number;
  endHour: number;
  preview: Preview | null;
  draft: Draft | null;
  dragging: DragData | null;
  overStrip: string | null;
  onOpenTask: (taskId: string, viaKeyboard?: boolean) => void;
  onRemoveEntry: (entry: EntryModel) => void;
  onRemoveBlock: (block: BlockModel) => void;
  onOpenEvent: (event: CalendarEvent, anchor: HTMLElement) => void;
  onDraw: (draft: Draft) => void;
  onCommitDraft: (title: string) => void;
  onCancelDraft: () => void;
}

export function WeekGrid({
  label,
  today,
  nowMinutes,
  days,
  startHour,
  endHour,
  preview,
  draft,
  dragging,
  overStrip,
  onOpenTask,
  onRemoveEntry,
  onRemoveBlock,
  onOpenEvent,
  onDraw,
  onCommitDraft,
  onCancelDraft,
}: Readonly<WeekGridProps>) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const carries = dragging?.kind === 'tray' || dragging?.kind === 'ficha';
  return (
    <div role="group" aria-label={label} className={styles.week}>
      <div className={styles.hours} aria-hidden="true">
        <div className={styles.labels}>
          {hours.map((hour) => (
            <div
              key={hour}
              className={styles.label}
              data-hour={hour}
              style={{ top: pixelsFromMinutes((hour - startHour) * 60) - 8 }}
            >
              {`${String(hour)}h`}
            </div>
          ))}
        </div>
      </div>
      {days.map((day, index) => {
        const isToday = day.date === today;
        return (
          <div key={day.date} className={styles.day}>
            <div className={styles.head} aria-current={isToday ? 'date' : undefined}>
              <span className={[styles.number, isToday ? styles.today : ''].join(' ').trim()}>
                {dayNumber(day.date)}
              </span>
              <span className={styles.weekday}>{WEEKDAYS[index]}</span>
            </div>
            <DayStrip
              date={day.date}
              entries={day.entries}
              movingItemId={dragging?.kind === 'ficha' ? dragging.item.id : null}
              targeted={carries && overStrip === day.date}
              onOpen={onOpenTask}
              onRemove={onRemoveEntry}
            />
            <DayColumn
              day={day}
              startHour={startHour}
              endHour={endHour}
              nowMinutes={isToday ? nowMinutes : null}
              preview={preview}
              draft={draft}
              onOpenTask={onOpenTask}
              onRemoveBlock={onRemoveBlock}
              onOpenEvent={onOpenEvent}
              onDraw={onDraw}
              onCommitDraft={onCommitDraft}
              onCancelDraft={onCancelDraft}
            />
          </div>
        );
      })}
    </div>
  );
}
