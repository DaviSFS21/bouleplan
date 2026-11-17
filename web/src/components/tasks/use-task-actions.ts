'use client';

import { useRef, useState } from 'react';
import {
  ARCHIVE_TASK_FAILED_MESSAGE,
  BLANK_TASK_TITLE_MESSAGE,
  DELETE_TASK_FAILED_MESSAGE,
  UNDO_FAILED_MESSAGE,
  updateTaskMessage,
  type TaskField,
} from '@/api/messages';
import {
  useArchiveTask,
  useDeleteTask,
  useRestoreTask,
  useUnarchiveTask,
  useUpdateTask,
} from '@/api/tasks';
import type { Task, TaskChanges, TaskStatus } from '@/api/types';
import { useToast } from '@/components/toast/toast';
import type { TaskPanelControl } from './task-board';
import { statusTitle } from './task-filter';
import type { TaskActions } from './task-menu';

// Where focus goes around a task's moves and removals; each screen knows its own layout.
export interface TaskFocus {
  // The card goes to this state: asked when the move starts, and again to put it back.
  moved?: (task: Task, status: TaskStatus) => void;
  // Asked before a removal; the returned function runs once it succeeded.
  leaving?: (task: Task) => () => void;
  // An undone removal brought the task back.
  restored?: (task: Task) => void;
}

interface Options {
  panel: TaskPanelControl;
  // null clears the last message.
  report: (message: string | null) => void;
  extra?: Pick<TaskActions, 'onAddToToday' | 'isInTodayList'>;
  focus?: TaskFocus;
}

// The actions of the task menus and the task panel, shared by the board and the week page.
export function useTaskActions({ panel, report, extra, focus }: Options) {
  const toast = useToast();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const unarchiveTask = useUnarchiveTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const [panelFocus, setPanelFocus] = useState(0);
  const busy = useRef(new Set<string>());

  async function change(task: Task, changes: TaskChanges, field: TaskField): Promise<boolean> {
    report(null);
    try {
      await updateTask.mutateAsync({ task, changes });
      return true;
    } catch (failure) {
      report(updateTaskMessage(failure, field));
      return false;
    }
  }

  async function move(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    const previous = task.status;
    focus?.moved?.(task, status);
    if (!(await change(task, { status }, 'status'))) {
      focus?.moved?.(task, previous);
      return;
    }
    toast.show({
      message: `Tarefa movida para ${statusTitle(status)}`,
      onUndo: () => {
        focus?.moved?.(task, previous);
        updateTask
          .mutateAsync({ task: { ...task, status }, changes: { status: previous } })
          .catch(() => {
            toast.show({ message: UNDO_FAILED_MESSAGE });
          });
      },
    });
  }

  async function leave(
    task: Task,
    action: (task: Task) => Promise<unknown>,
    undo: (task: Task) => Promise<unknown>,
    messages: { done: string; failed: string },
  ) {
    if (busy.current.has(task.id)) return;
    busy.current.add(task.id);
    const wasOpen = panel.openId === task.id;
    const afterLeaving = focus?.leaving?.(task);
    report(null);
    try {
      await action(task);
    } catch {
      report(messages.failed);
      return;
    } finally {
      busy.current.delete(task.id);
    }
    if (wasOpen) panel.close(task.id);
    afterLeaving?.();
    toast.show({
      message: messages.done,
      onUndo: () => {
        undo(task).then(
          () => {
            focus?.restored?.(task);
            if (wasOpen) panel.reopen(task.id);
          },
          () => {
            toast.show({ message: UNDO_FAILED_MESSAGE });
          },
        );
      },
    });
  }

  const actions: TaskActions = {
    onOpen: (task, viaKeyboard = false) => {
      panel.open(task.id);
      if (viaKeyboard) setPanelFocus((signal) => signal + 1);
    },
    onClose: () => {
      panel.close();
    },
    onRename: (task, title) => {
      if (title === '') {
        report(BLANK_TASK_TITLE_MESSAGE);
        return;
      }
      void change(task, { title }, 'title');
    },
    onPriority: (task, priority) => {
      if (task.priority !== priority) void change(task, { priority }, 'priority');
    },
    onMove: (task, status) => {
      void move(task, status);
    },
    onToggleBlocked: (task) => {
      void change(task, { isBlocked: !task.isBlocked }, 'isBlocked');
    },
    onArchive: (task) => {
      void leave(task, archiveTask.mutateAsync, unarchiveTask.mutateAsync, {
        done: 'Tarefa arquivada',
        failed: ARCHIVE_TASK_FAILED_MESSAGE,
      });
    },
    onDelete: (task) => {
      void leave(task, deleteTask.mutateAsync, restoreTask.mutateAsync, {
        done: 'Tarefa excluída',
        failed: DELETE_TASK_FAILED_MESSAGE,
      });
    },
    ...extra,
  };

  return {
    actions,
    panelFocus,
    focusPanel: () => {
      setPanelFocus((signal) => signal + 1);
    },
  };
}
