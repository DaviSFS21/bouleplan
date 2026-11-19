'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CalendarEvent } from '@/api/types';
import { useIsPhone } from '@/components/responsive/use-media-query';
import { TabStrip, tabPanelProps } from '@/components/tab-strip/tab-strip';
import { DayColumn, type Draft } from './day-column';
import { DayStrip } from './day-strip';
import { dayLabel, dayNumber, WEEKDAYS } from './planner-dates';
import type { DragData, Preview } from './planner-drop';
import { focusOffset, pixelsFromMinutes } from './planner-geometry';
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
  onEditBlock: (block: BlockModel) => void;
  onOpenEvent: (event: CalendarEvent) => void;
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
  onEditBlock,
  onOpenEvent,
  onDraw,
  onCommitDraft,
  onCancelDraft,
}: Readonly<WeekGridProps>) {
  const phone = useIsPhone();
  const prefix = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const week = useRef<HTMLDivElement>(null);
  const clock = useRef(nowMinutes);
  const weekStart = days[0]?.date;
  // The phone shows one day: the picked one, else today, else the first.
  const shown =
    days.find(({ date }) => date === picked)?.date ??
    (days.some(({ date }) => date === today) ? today : (days[0]?.date ?? ''));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);

  useEffect(() => {
    clock.current = nowMinutes;
  }, [nowMinutes]);

  // Each week opens on its focal hours, or on the now line when that lies outside them.
  useEffect(() => {
    const scroller = week.current;
    const agenda = scroller?.querySelector<HTMLElement>('[data-day]');
    if (!scroller || !agenda) return;
    const head = scroller.querySelector<HTMLElement>('[data-week-head]');
    const top =
      agenda.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTop =
      top - (head?.offsetHeight ?? 0) + focusOffset(clock.current, scroller.clientHeight);
  }, [weekStart]);
  const carries = dragging?.kind === 'tray' || dragging?.kind === 'ficha';
  return (
    <div className={styles.scroller}>
      {phone ? (
        <TabStrip
          label="Dias da semana"
          prefix={prefix}
          items={days.map((day, index) => {
            const isToday = day.date === today;
            return {
              id: day.date,
              // Starts with the visible text so voice control can say what it sees.
              label: `${String(dayNumber(day.date))} ${WEEKDAYS[index] ?? ''}, ${dayLabel(day.date)}${isToday ? ', hoje' : ''}`,
              className: isToday ? styles.todayTab : undefined,
              content: (
                <>
                  <span className={styles.tabNumber}>{dayNumber(day.date)}</span>{' '}
                  <span className={styles.tabWeekday}>{WEEKDAYS[index]}</span>
                </>
              ),
            };
          })}
          selectedId={shown}
          onSelect={setPicked}
          className={styles.dayTabs}
          tabClassName={styles.dayTab}
        />
      ) : null}
      <div ref={week} data-week-scroller="" role="group" aria-label={label} className={styles.week}>
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
        {days
          .filter((day) => !phone || day.date === shown)
          .map((day) => {
            const isToday = day.date === today;
            const index = days.indexOf(day);
            return (
              <div
                key={day.date}
                {...(phone ? tabPanelProps(prefix, shown) : {})}
                className={styles.day}
              >
                <div
                  className={styles.head}
                  data-week-head
                  aria-current={isToday ? 'date' : undefined}
                >
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
                  onEditBlock={onEditBlock}
                  onOpenEvent={onOpenEvent}
                  onDraw={onDraw}
                  onCommitDraft={onCommitDraft}
                  onCancelDraft={onCancelDraft}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}
