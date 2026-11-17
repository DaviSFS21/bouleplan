import type { ClientRect, Collision } from '@dnd-kit/core';
import { describe, expect, it, vi } from 'vitest';
import { compareTasks } from '@/api/tasks';
import { task } from '@/test/fixtures';
import {
  announcements,
  columnCollision,
  columnKeyboardCoordinates,
  landingIndex,
} from './task-dnd';

function rect(left: number, width = 100): ClientRect {
  return { left, right: left + width, top: 0, bottom: 500, width, height: 500 };
}

const rects = new Map<string, ClientRect>([
  ['to_do', rect(0)],
  ['in_progress', rect(200)],
  ['done', rect(400)],
]);
const containers = ['to_do', 'in_progress', 'done'].map((id) => ({ id }));

function collide(x: number, usePointer: boolean): Collision[] {
  return columnCollision({
    collisionRect: rect(x - 20, 40),
    droppableRects: rects,
    droppableContainers: containers,
    pointerCoordinates: usePointer ? { x, y: 10 } : null,
  } as never);
}

describe('columnCollision', () => {
  it.each([
    [50, 'to_do'],
    [250, 'in_progress'],
    [450, 'done'],
  ])('picks the column under the pointer at x=%s', (x, id) => {
    expect(collide(x, true).map((hit) => hit.id)).toEqual([id]);
  });

  it('uses the center of the dragged card without a pointer', () => {
    expect(collide(250, false).map((hit) => hit.id)).toEqual(['in_progress']);
  });

  it('hits nothing in the gap between columns', () => {
    expect(collide(150, true)).toEqual([]);
  });

  it('skips a column that has not been measured', () => {
    const partial = new Map(rects);
    partial.delete('in_progress');

    const hits = columnCollision({
      collisionRect: rect(230, 40),
      droppableRects: partial,
      droppableContainers: containers,
      pointerCoordinates: { x: 250, y: 10 },
    } as never);

    expect(hits).toEqual([]);
  });
});

function keyboard(
  code: string,
  context: {
    over?: { id: string } | null;
    active?: object | null;
    collisionRect?: ClientRect | null;
  },
  available = containers,
) {
  const preventDefault = vi.fn();
  const result = columnKeyboardCoordinates(
    { code, preventDefault } as never,
    {
      active: null,
      currentCoordinates: { x: 0, y: 0 },
      context: {
        active: context.active === undefined ? {} : context.active,
        collisionRect: context.collisionRect === undefined ? rect(10, 40) : context.collisionRect,
        droppableRects: rects,
        droppableContainers: { getEnabled: () => available },
        over: context.over === undefined ? null : context.over,
      },
    } as never,
  );
  return { result, preventDefault };
}

describe('columnKeyboardCoordinates', () => {
  it('centers the dragged card on the next column to the right', () => {
    const { result, preventDefault } = keyboard('ArrowRight', { over: { id: 'to_do' } });

    expect(result).toEqual({ x: 200 + (100 - 40) / 2, y: 0 });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('goes back to the previous column on the left arrow', () => {
    expect(keyboard('ArrowLeft', { over: { id: 'done' } }).result).toEqual({ x: 230, y: 0 });
  });

  it('finds the current column by position when nothing is over yet', () => {
    expect(keyboard('ArrowRight', { over: null }).result).toEqual({ x: 230, y: 0 });
  });

  it('stays put at the first and last column', () => {
    expect(keyboard('ArrowLeft', { over: { id: 'to_do' } }).result).toBeUndefined();
    expect(keyboard('ArrowRight', { over: { id: 'done' } }).result).toBeUndefined();
  });

  it.each(['ArrowUp', 'ArrowDown', 'KeyA'])('ignores %s without blocking it', (code) => {
    const { result, preventDefault } = keyboard(code, { over: { id: 'to_do' } });

    expect(result).toBeUndefined();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does nothing without an active card or its measured rect', () => {
    expect(keyboard('ArrowRight', { active: null }).result).toBeUndefined();
    expect(keyboard('ArrowRight', { collisionRect: null }).result).toBeUndefined();
  });

  it('skips columns that were not measured', () => {
    const { result } = keyboard('ArrowRight', { over: { id: 'to_do' } }, [
      { id: 'to_do' },
      { id: 'ghost' },
    ]);

    expect(result).toBeUndefined();
  });
});

describe('landingIndex', () => {
  const column = [
    task({ id: 'a', priority: 'P1' }),
    task({ id: 'b', priority: 'P2', deadline: '2026-11-10' }),
    task({ id: 'c', priority: 'P3' }),
  ];

  it('counts the cards that sort before the dragged one', () => {
    expect(landingIndex(column, task({ id: 'd', priority: 'P2' }), compareTasks)).toBe(2);
    expect(
      landingIndex(
        column,
        task({ id: 'e', priority: 'P1', createdAt: '2025-01-01T00:00:00Z' }),
        compareTasks,
      ),
    ).toBe(0);
    expect(
      landingIndex(
        column,
        task({ id: 'f', priority: 'P3', createdAt: '2027-01-01T00:00:00Z' }),
        compareTasks,
      ),
    ).toBe(3);
  });

  it('never counts the dragged card itself', () => {
    expect(landingIndex(column, column[2] ?? task(), compareTasks)).toBe(2);
  });
});

describe('announcements', () => {
  const active = {
    id: 'x',
    data: { current: { task: task({ title: 'Pintar', status: 'done' }) } },
  };
  const bare = { id: 'x', data: { current: undefined } };

  it('speaks pt-BR for every step', () => {
    const over = { id: 'in_progress', data: { current: undefined } };

    expect(announcements.onDragStart({ active } as never)).toBe(
      'Você pegou a tarefa Pintar, na coluna Feito.',
    );
    expect(announcements.onDragOver({ active, over } as never)).toBe(
      'A tarefa Pintar está sobre a coluna Em andamento.',
    );
    expect(announcements.onDragOver({ active, over: null } as never)).toBe(
      'A tarefa Pintar está fora das colunas.',
    );
    expect(announcements.onDragEnd({ active, over } as never)).toBe(
      'A tarefa Pintar foi solta na coluna Em andamento.',
    );
    expect(announcements.onDragEnd({ active, over: null } as never)).toBe(
      'A tarefa Pintar foi solta fora das colunas e não mudou.',
    );
    expect(announcements.onDragCancel({ active } as never)).toBe(
      'Movimento cancelado. A tarefa Pintar continua na coluna Feito.',
    );
  });

  it('copes with a card that carries no task data', () => {
    expect(announcements.onDragStart({ active: bare } as never)).toBe(
      'Você pegou a tarefa , na coluna .',
    );
  });
});
