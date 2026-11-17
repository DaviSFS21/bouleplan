import { describe, expect, it } from 'vitest';
import {
  blockStyle,
  dropStartFromPointer,
  drawnSpan,
  quarterAt,
  findOverlap,
  fitSpan,
  layoutLanes,
  moveStart,
  overlaps,
  resizeEnd,
  timeFromPointer,
  visibleHours,
} from './planner-geometry';

describe('overlaps', () => {
  it('treats spans as [start, end)', () => {
    expect(overlaps({ start: 540, end: 600 }, { start: 570, end: 630 })).toBe(true);
    expect(overlaps({ start: 540, end: 600 }, { start: 600, end: 660 })).toBe(false);
    expect(overlaps({ start: 600, end: 660 }, { start: 540, end: 600 })).toBe(false);
    expect(overlaps({ start: 540, end: 720 }, { start: 600, end: 660 })).toBe(true);
    expect(overlaps({ start: 540, end: 600 }, { start: 540, end: 600 })).toBe(true);
  });
});

describe('findOverlap', () => {
  const blocks = [
    { id: 'a', start: 540, end: 600 },
    { id: 'b', start: 660, end: 720 },
  ];

  it('returns the block in the way', () => {
    expect(findOverlap({ start: 590, end: 650 }, blocks)?.id).toBe('a');
    expect(findOverlap({ start: 600, end: 660 }, blocks)).toBeUndefined();
  });

  it('ignores the block being moved', () => {
    expect(findOverlap({ start: 540, end: 600 }, blocks, 'a')).toBeUndefined();
    expect(findOverlap({ start: 570, end: 700 }, blocks, 'a')?.id).toBe('b');
  });
});

describe('fitSpan', () => {
  it('keeps the span inside the day', () => {
    expect(fitSpan(-30, 60)).toEqual({ start: 0, end: 60 });
    expect(fitSpan(1400, 60)).toEqual({ start: 1365, end: 1425 });
    expect(fitSpan(600, 90)).toEqual({ start: 600, end: 690 });
  });
});

describe('drop time', () => {
  it('turns the pointer height into a quarter hour of the day', () => {
    expect(timeFromPointer(100 + 24, 100, 8)).toBe(8 * 60 + 30);
    expect(timeFromPointer(100, 100, 8)).toBe(8 * 60);
    expect(timeFromPointer(100 + 50, 100, 8)).toBe(8 * 60 + 60);
    expect(timeFromPointer(100 + 54, 100, 8)).toBe(8 * 60 + 60 + 15);
  });

  it('never goes before midnight', () => {
    expect(timeFromPointer(0, 400, 0)).toBe(0);
  });

  it('places a new block from the pointer and keeps it in the day', () => {
    expect(dropStartFromPointer(200 + 48, 200, 8, 120)).toEqual({ start: 9 * 60, end: 11 * 60 });
    expect(dropStartFromPointer(200 + 48 * 16, 200, 8, 120)).toEqual({
      start: 1425 - 120,
      end: 1425,
    });
  });

  it('moves a block by the pointer travel, snapped to 15 minutes', () => {
    expect(moveStart(540, 24)).toBe(570);
    expect(moveStart(540, -48)).toBe(480);
    expect(moveStart(540, 5)).toBe(540);
    expect(moveStart(540, 7)).toBe(555);
  });
});

describe('resizeEnd', () => {
  const others = [{ id: 'n', start: 720, end: 780 }];

  it('snaps the new end to a quarter hour', () => {
    expect(resizeEnd({ start: 540, end: 600 }, 24, [])).toBe(630);
    expect(resizeEnd({ start: 540, end: 600 }, 5, [])).toBe(600);
  });

  it('keeps at least 15 minutes', () => {
    expect(resizeEnd({ start: 540, end: 600 }, -480, [])).toBe(555);
  });

  it('stops at the next block', () => {
    expect(resizeEnd({ start: 540, end: 600 }, 480, others)).toBe(720);
  });

  it('is not held back by blocks before it', () => {
    expect(resizeEnd({ start: 780, end: 840 }, 48, others)).toBe(900);
  });

  it('stops at the end of the day', () => {
    expect(resizeEnd({ start: 1380, end: 1400 }, 4800, [])).toBe(1425);
  });
});

describe('visibleHours', () => {
  it('defaults to 8h-18h', () => {
    expect(visibleHours([], null)).toEqual({ startHour: 8, endHour: 18 });
  });

  it('expands to whole hours around what is scheduled', () => {
    expect(visibleHours([{ start: 7 * 60 + 30, end: 9 * 60 }], null)).toEqual({
      startHour: 7,
      endHour: 18,
    });
    expect(visibleHours([{ start: 17 * 60, end: 19 * 60 + 15 }], null)).toEqual({
      startHour: 8,
      endHour: 20,
    });
    expect(
      visibleHours(
        [
          { start: 0, end: 15 },
          { start: 1380, end: 1425 },
        ],
        null,
      ),
    ).toEqual({
      startHour: 0,
      endHour: 24,
    });
  });

  it('keeps the default when everything fits', () => {
    expect(visibleHours([{ start: 9 * 60, end: 10 * 60 }], 12 * 60)).toEqual({
      startHour: 8,
      endHour: 18,
    });
  });

  it('includes the now line', () => {
    expect(visibleHours([], 6 * 60 + 5)).toEqual({ startHour: 6, endHour: 18 });
    expect(visibleHours([], 20 * 60 + 5)).toEqual({ startHour: 8, endHour: 21 });
    expect(visibleHours([], 18 * 60)).toEqual({ startHour: 8, endHour: 18 });
  });
});

describe('blockStyle', () => {
  it('positions by the time at 48px per hour, leaving a gap between blocks', () => {
    expect(blockStyle({ start: 9 * 60, end: 9 * 60 + 30 }, 8)).toEqual({ top: 48, height: 20 });
    expect(blockStyle({ start: 10 * 60, end: 12 * 60 }, 8)).toEqual({ top: 96, height: 92 });
  });

  it('keeps a short block tall enough to see', () => {
    expect(blockStyle({ start: 540, end: 555 }, 8).height).toBe(8);
  });
});

describe('drawing a span', () => {
  it('takes the quarter hour under the pointer, rounding down', () => {
    expect(quarterAt(100 + 7, 100, 8)).toBe(8 * 60);
    expect(quarterAt(100 + 12, 100, 8)).toBe(8 * 60 + 15);
    expect(quarterAt(100 + 48 + 12, 100, 8)).toBe(9 * 60 + 15);
  });

  it('stays inside the day', () => {
    expect(quarterAt(0, 500, 8)).toBe(0);
    expect(quarterAt(100 + 48 * 20, 100, 8)).toBe(1410);
  });

  it('covers both quarters, whichever way it is drawn', () => {
    expect(drawnSpan(540, 540)).toEqual({ start: 540, end: 555 });
    expect(drawnSpan(540, 585)).toEqual({ start: 540, end: 600 });
    expect(drawnSpan(585, 540)).toEqual({ start: 540, end: 600 });
  });
});

describe('layoutLanes', () => {
  it('gives a lone block the whole width', () => {
    expect(layoutLanes([{ id: 'a', start: 540, end: 600 }]).get('a')).toEqual({
      column: 0,
      columns: 1,
    });
  });

  it('puts blocks that only touch in their own full width', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 600, end: 660 },
    ]);
    expect(lanes.get('a')?.columns).toBe(1);
    expect(lanes.get('b')).toEqual({ column: 0, columns: 1 });
  });

  it('splits the width between blocks that overlap', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 660 },
      { id: 'b', start: 600, end: 720 },
    ]);
    expect(lanes.get('a')).toEqual({ column: 0, columns: 2 });
    expect(lanes.get('b')).toEqual({ column: 1, columns: 2 });
  });

  it('reuses a free column inside a group and sizes every block of the group alike', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 720 },
      { id: 'c', start: 610, end: 660 },
    ]);
    expect(lanes.get('c')).toEqual({ column: 0, columns: 2 });
    expect(lanes.get('a')?.columns).toBe(2);
  });

  it('handles no blocks', () => {
    expect(layoutLanes([]).size).toBe(0);
  });
});
