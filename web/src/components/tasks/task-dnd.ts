import { KeyboardCode } from '@dnd-kit/core';
import type {
  Announcements,
  CollisionDetection,
  KeyboardCoordinateGetter,
  ScreenReaderInstructions,
} from '@dnd-kit/core';
import type { Task, TaskStatus } from '@/api/types';
import { statusTitle } from './task-filter';

export const DRAG_ACTIVATION_DISTANCE = 6;

// Enter opens the task, so only Space picks it up and drops it.
export const KEYBOARD_CODES = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space],
};

export interface DraggedTask {
  task: Task;
}

function titleOf(item: { data: { current?: Partial<DraggedTask> } }): string {
  return item.data.current?.task?.title ?? '';
}

function columnOf(item: { id: string | number }): string {
  return statusTitle(item.id as TaskStatus);
}

// Columns are laid out side by side, so only the horizontal position picks the target.
export const columnCollision: CollisionDetection = ({
  collisionRect,
  droppableRects,
  droppableContainers,
  pointerCoordinates,
}) => {
  const x = pointerCoordinates?.x ?? collisionRect.left + collisionRect.width / 2;
  return droppableContainers
    .filter((container) => {
      const rect = droppableRects.get(container.id);
      return rect !== undefined && x >= rect.left && x <= rect.right;
    })
    .map((container) => ({ id: container.id, data: { droppableContainer: container } }));
};

export const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { active, collisionRect, droppableRects, droppableContainers, over } },
) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (step === 0 || !active || !collisionRect) return undefined;
  event.preventDefault();
  const columns = droppableContainers
    .getEnabled()
    .flatMap((container) => {
      const rect = droppableRects.get(container.id);
      return rect ? [{ id: container.id, rect }] : [];
    })
    .sort((a, b) => a.rect.left - b.rect.left);
  const centerX = collisionRect.left + collisionRect.width / 2;
  const current = columns.findIndex(({ id, rect }) =>
    over ? id === over.id : centerX >= rect.left && centerX <= rect.right,
  );
  const target = columns[current + step];
  if (!target) return undefined;
  return {
    x: target.rect.left + (target.rect.width - collisionRect.width) / 2,
    y: collisionRect.top,
  };
};

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Para pegar a tarefa, pressione Espaço. Use as setas para a esquerda e para a direita para escolher a coluna, Espaço para soltar e Esc para cancelar. Enter abre a tarefa.',
};

export const announcements: Announcements = {
  onDragStart: ({ active }) =>
    `Você pegou a tarefa ${titleOf(active)}, na coluna ${statusOfActive(active)}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `A tarefa ${titleOf(active)} está sobre a coluna ${columnOf(over)}.`
      : `A tarefa ${titleOf(active)} está fora das colunas.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `A tarefa ${titleOf(active)} foi solta na coluna ${columnOf(over)}.`
      : `A tarefa ${titleOf(active)} foi solta fora das colunas e não mudou.`,
  onDragCancel: ({ active }) =>
    `Movimento cancelado. A tarefa ${titleOf(active)} continua na coluna ${statusOfActive(active)}.`,
};

function statusOfActive(active: { data: { current?: Partial<DraggedTask> } }): string {
  const status = active.data.current?.task?.status;
  return status ? statusTitle(status) : '';
}

// Index where a task lands in a column that is sorted by the given comparison.
export function landingIndex(
  column: readonly Task[],
  dragged: Task,
  compare: (a: Task, b: Task) => number,
): number {
  return column.filter((task) => task.id !== dragged.id && compare(task, dragged) < 0).length;
}
