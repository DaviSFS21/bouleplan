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
import { statusTitle } from '@/components/tasks/task-filter';
import type { TaskPanelControl } from '@/components/tasks/task-board';
import type { TaskActions } from '@/components/tasks/task-menu';

interface Options {
  panel: TaskPanelControl;
  report: (message: string | null) => void;
  addToToday: (task: Task) => void;
  isInToday: (task: Task) => boolean;
}

// The task actions of the board, for the task panel opened on the week page.
export function useWeekTaskActions({ panel, report, addToToday, isInToday }: Options) {
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
    if (!(await change(task, { status }, 'status'))) return;
    toast.show({
      message: `Tarefa movida para ${statusTitle(status)}`,
      onUndo: () => {
        updateTask
          .mutateAsync({ task: { ...task, status }, changes: { status: task.status } })
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
    toast.show({
      message: messages.done,
      onUndo: () => {
        undo(task).then(
          () => {
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
    onAddToToday: addToToday,
    isInTodayList: isInToday,
  };

  return {
    actions,
    panelFocus,
    focusPanel: () => {
      setPanelFocus((signal) => signal + 1);
    },
  };
}
