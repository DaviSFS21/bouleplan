import type { components } from './schema';

export type Initiative = components['schemas']['Initiative'];
export type InitiativeColor = Initiative['color'];
export type Problem = components['schemas']['Problem'];
export type Phase = components['schemas']['Phase'];

export type Task = components['schemas']['Task'];
export type TaskPriority = Task['priority'];
export type TaskStatus = Task['status'];
export type CreateTaskBody = components['schemas']['CreateTaskRequest'];
export type TaskChanges = Pick<
  components['schemas']['UpdateTaskRequest'],
  | 'title'
  | 'description'
  | 'deadline'
  | 'estimatedEffort'
  | 'priority'
  | 'status'
  | 'isBlocked'
  | 'phaseId'
  | 'plannedWeekStart'
>;
