import type { Task, TaskPriority, TaskStatus } from '@/api/types';
import type { ActionMenuEntry } from '@/components/action-menu/action-menu';
import { seloClassName } from '@/components/selo/selo';
import { STATUSES, statusTitle } from './task-filter';

export const PRIORITIES: readonly TaskPriority[] = ['P1', 'P2', 'P3'];

export interface TaskActions {
  // viaKeyboard moves focus into the panel, as for the first open.
  onOpen: (task: Task, viaKeyboard?: boolean) => void;
  onClose: () => void;
  onRename: (task: Task, title: string) => void;
  onPriority: (task: Task, priority: TaskPriority) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onToggleBlocked: (task: Task) => void;
  onArchive: (task: Task) => void;
  onDelete: (task: Task) => void;
}

interface TaskMenuOptions {
  onEditTitle: () => void;
  // The panel's own menu leaves "Abrir" out.
  withOpen: boolean;
}

export function taskMenuItems(
  task: Task,
  actions: TaskActions,
  { onEditTitle, withOpen }: TaskMenuOptions,
): ActionMenuEntry[] {
  return [
    ...(withOpen
      ? [
          {
            label: 'Abrir',
            shortcut: 'Enter',
            onSelect: () => {
              actions.onOpen(task, true);
            },
          },
        ]
      : []),
    { label: 'Editar título', shortcut: 'E', onSelect: onEditTitle },
    { separator: true },
    {
      group: 'Prioridade',
      items: PRIORITIES.map((priority) => ({
        label: priority,
        checked: task.priority === priority,
        chipClassName: seloClassName(priority),
        onSelect: () => {
          actions.onPriority(task, priority);
        },
      })),
    },
    { separator: true },
    {
      group: 'Mover para',
      items: STATUSES.map((status) => ({
        label: statusTitle(status),
        checked: task.status === status,
        onSelect: () => {
          actions.onMove(task, status);
        },
      })),
    },
    { separator: true },
    {
      label: task.isBlocked ? 'Desbloquear' : 'Marcar como bloqueada',
      onSelect: () => {
        actions.onToggleBlocked(task);
      },
    },
    { separator: true },
    {
      label: 'Arquivar',
      onSelect: () => {
        actions.onArchive(task);
      },
    },
    {
      label: 'Excluir',
      onSelect: () => {
        actions.onDelete(task);
      },
    },
  ];
}
