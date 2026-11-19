import { ApiError } from './problem';

export const BLANK_NAME_MESSAGE = 'Dê um nome à iniciativa.';

const CREATE_INITIATIVE_MESSAGES: Readonly<Record<string, string>> = {
  'initiative.name.blank': BLANK_NAME_MESSAGE,
  'initiative.name.too-long': 'Use no máximo 200 caracteres.',
  'initiative.name.invalid-characters': 'O nome tem caracteres inválidos.',
};

export const CREATE_INITIATIVE_FALLBACK_MESSAGE =
  'Não foi possível criar a iniciativa. Tente de novo.';

export function createInitiativeMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return CREATE_INITIATIVE_MESSAGES[error.code] ?? CREATE_INITIATIVE_FALLBACK_MESSAGE;
  }
  return CREATE_INITIATIVE_FALLBACK_MESSAGE;
}

export type InitiativeField = 'name' | 'description' | 'overallDeadline' | 'color';

export const UPDATE_INITIATIVE_FALLBACK_MESSAGE = 'Não foi possível salvar. Tente de novo.';

const UPDATE_INITIATIVE_MESSAGES: Readonly<
  Record<InitiativeField, Readonly<Record<string, string>>>
> = {
  name: CREATE_INITIATIVE_MESSAGES,
  description: {
    'initiative.description.too-long': 'Use no máximo 10.000 caracteres.',
    'initiative.description.invalid-characters': 'A descrição tem caracteres inválidos.',
  },
  overallDeadline: { 'initiative.deadline.invalid': 'Use uma data válida.' },
  color: {},
};

export function updateInitiativeMessage(error: unknown, field: InitiativeField): string {
  if (error instanceof ApiError) {
    return UPDATE_INITIATIVE_MESSAGES[field][error.code] ?? UPDATE_INITIATIVE_FALLBACK_MESSAGE;
  }
  return UPDATE_INITIATIVE_FALLBACK_MESSAGE;
}

export const ARCHIVE_INITIATIVE_FAILED_MESSAGE =
  'Não foi possível arquivar a iniciativa. Tente de novo.';
export const DELETE_INITIATIVE_FAILED_MESSAGE =
  'Não foi possível excluir a iniciativa. Tente de novo.';
export const UNDO_FAILED_MESSAGE = 'Não foi possível desfazer. Tente de novo.';

export const SAVE_FAILED_MESSAGES: Readonly<Record<InitiativeField, string>> = {
  name: 'Não foi possível salvar o nome. Tente de novo.',
  description: 'Não foi possível salvar a descrição. Tente de novo.',
  overallDeadline: 'Não foi possível salvar o prazo. Tente de novo.',
  color: 'Não foi possível salvar a cor. Tente de novo.',
};

export const BLANK_EPIC_NAME_MESSAGE = 'Dê um nome ao épico.';

const EPIC_NAME_MESSAGES: Readonly<Record<string, string>> = {
  'epic.name.blank': BLANK_EPIC_NAME_MESSAGE,
  'epic.name.too-long': 'Use no máximo 200 caracteres.',
  'epic.name.invalid-characters': 'O nome tem caracteres inválidos.',
};

export const CREATE_EPIC_FALLBACK_MESSAGE = 'Não foi possível criar o épico. Tente de novo.';
export const RENAME_EPIC_FALLBACK_MESSAGE = 'Não foi possível salvar o nome. Tente de novo.';
export const ARCHIVE_EPIC_FAILED_MESSAGE = 'Não foi possível arquivar o épico. Tente de novo.';
export const DELETE_EPIC_FAILED_MESSAGE = 'Não foi possível excluir o épico. Tente de novo.';

function epicNameMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? (EPIC_NAME_MESSAGES[error.code] ?? fallback) : fallback;
}

export function createEpicMessage(error: unknown): string {
  return epicNameMessage(error, CREATE_EPIC_FALLBACK_MESSAGE);
}

export function renameEpicMessage(error: unknown): string {
  return epicNameMessage(error, RENAME_EPIC_FALLBACK_MESSAGE);
}

export function epicCountSuffix(count: number): string {
  if (count === 0) return '';
  return `, com ${String(count)} ${count === 1 ? 'épico' : 'épicos'}`;
}

export const BLANK_TASK_TITLE_MESSAGE = 'Dê um título à tarefa.';

const TASK_TITLE_MESSAGES: Readonly<Record<string, string>> = {
  'task.title.blank': BLANK_TASK_TITLE_MESSAGE,
  'task.title.too-long': 'Use no máximo 300 caracteres.',
  'task.title.invalid-characters': 'O título tem caracteres inválidos.',
};

export const CREATE_TASK_FALLBACK_MESSAGE = 'Não foi possível criar a tarefa. Tente de novo.';
export const ARCHIVE_TASK_FAILED_MESSAGE = 'Não foi possível arquivar a tarefa. Tente de novo.';
export const DELETE_TASK_FAILED_MESSAGE = 'Não foi possível excluir a tarefa. Tente de novo.';

export function createTaskMessage(error: unknown): string {
  return error instanceof ApiError
    ? (TASK_TITLE_MESSAGES[error.code] ?? CREATE_TASK_FALLBACK_MESSAGE)
    : CREATE_TASK_FALLBACK_MESSAGE;
}

export type TaskField =
  | 'title'
  | 'description'
  | 'deadline'
  | 'estimatedEffort'
  | 'priority'
  | 'status'
  | 'isBlocked'
  | 'epicId'
  | 'plannedWeekStart';

export const INVALID_EFFORT_MESSAGE = 'Use de 0,01 a 999 horas, com até 2 casas decimais.';

const UPDATE_TASK_MESSAGES: Readonly<Record<TaskField, Readonly<Record<string, string>>>> = {
  title: TASK_TITLE_MESSAGES,
  description: {
    'task.description.too-long': 'Use no máximo 10.000 caracteres.',
    'task.description.invalid-characters': 'A descrição tem caracteres inválidos.',
  },
  deadline: { 'task.deadline.invalid': 'Use uma data válida.' },
  estimatedEffort: { 'task.effort.invalid': INVALID_EFFORT_MESSAGE },
  priority: {},
  status: {},
  isBlocked: {},
  epicId: { 'http.404': 'Esse épico não existe mais.' },
  plannedWeekStart: { 'task.planned-week.invalid': 'Escolha uma semana válida.' },
};

const UPDATE_TASK_FALLBACK_MESSAGES: Readonly<Record<TaskField, string>> = {
  title: 'Não foi possível salvar o título. Tente de novo.',
  description: 'Não foi possível salvar a descrição. Tente de novo.',
  deadline: 'Não foi possível salvar o prazo. Tente de novo.',
  estimatedEffort: 'Não foi possível salvar o esforço. Tente de novo.',
  priority: 'Não foi possível mudar a prioridade. Tente de novo.',
  status: 'Não foi possível mover a tarefa. Tente de novo.',
  isBlocked: 'Não foi possível atualizar o bloqueio. Tente de novo.',
  epicId: 'Não foi possível mudar o épico. Tente de novo.',
  plannedWeekStart: 'Não foi possível salvar a semana. Tente de novo.',
};

export function updateTaskMessage(error: unknown, field: TaskField): string {
  const fallback = UPDATE_TASK_FALLBACK_MESSAGES[field];
  return error instanceof ApiError
    ? (UPDATE_TASK_MESSAGES[field][error.code] ?? fallback)
    : fallback;
}

export const ADD_BLOCKER_FALLBACK_MESSAGE = 'Não foi possível adicionar o bloqueio. Tente de novo.';
export const REMOVE_BLOCKER_FALLBACK_MESSAGE =
  'Não foi possível remover o bloqueio. Tente de novo.';

const BLOCKER_MESSAGES: Readonly<Record<string, string>> = {
  'task.blocker.self': 'Uma tarefa não pode bloquear a si mesma.',
  'task.blocker.cycle': 'Isso criaria um ciclo: a outra tarefa já depende desta.',
  'http.404': 'Essa tarefa não existe mais.',
};

export function blockerMessage(error: unknown, action: 'add' | 'remove'): string {
  const fallback =
    action === 'add' ? ADD_BLOCKER_FALLBACK_MESSAGE : REMOVE_BLOCKER_FALLBACK_MESSAGE;
  return error instanceof ApiError ? (BLOCKER_MESSAGES[error.code] ?? fallback) : fallback;
}

export type PlannerAction =
  | 'add-to-list'
  | 'reserve'
  | 'move'
  | 'resize'
  | 'remove'
  | 'create-event'
  | 'update-event'
  | 'remove-event';

export const OVERLAP_MESSAGE = 'Já há tempo reservado nesse horário.';
export const DUPLICATE_ITEM_MESSAGE = 'Essa tarefa já está na lista desse dia.';
export const BLANK_EVENT_TITLE_MESSAGE = 'Dê um título ao compromisso.';
export const BLOCKED_DROP_MESSAGE = 'não cabe aqui · já há tempo reservado';

const PLANNER_FALLBACK_MESSAGES: Readonly<Record<PlannerAction, string>> = {
  'add-to-list': 'Não foi possível pôr na lista do dia. Tente de novo.',
  reserve: 'Não foi possível reservar o tempo. Tente de novo.',
  move: 'Não foi possível mover. Tente de novo.',
  resize: 'Não foi possível ajustar a duração. Tente de novo.',
  remove: 'Não foi possível tirar da agenda. Tente de novo.',
  'create-event': 'Não foi possível criar o compromisso. Tente de novo.',
  'update-event': 'Não foi possível salvar o compromisso. Tente de novo.',
  'remove-event': 'Não foi possível excluir o compromisso. Tente de novo.',
};

const PLANNER_MESSAGES: Readonly<Record<string, string>> = {
  'scheduled-item.overlap': OVERLAP_MESSAGE,
  'scheduled-item.duplicate': DUPLICATE_ITEM_MESSAGE,
  'scheduled-item.task-done': 'Tarefas feitas não vão para a semana.',
  'scheduled-item.time.invalid': 'Use horários de 15 em 15 minutos, dentro do mesmo dia.',
  'calendar-event.title.blank': BLANK_EVENT_TITLE_MESSAGE,
  'calendar-event.title.too-long': 'Use no máximo 300 caracteres.',
  'calendar-event.title.invalid-characters': 'O título tem caracteres inválidos.',
  'calendar-event.time.invalid': 'Use horários de 15 em 15 minutos, dentro do mesmo dia.',
  'http.404': 'Esse item não existe mais.',
};

export function plannerMessage(error: unknown, action: PlannerAction): string {
  const fallback = PLANNER_FALLBACK_MESSAGES[action];
  return error instanceof ApiError ? (PLANNER_MESSAGES[error.code] ?? fallback) : fallback;
}

export const LOAD_PLANNER_FAILED_MESSAGE = 'Não foi possível carregar a semana.';

export type IntrospectionAction = 'save' | 'close';

const INTROSPECTION_MESSAGES: Readonly<Record<string, string>> = {
  'introspection.closed': 'Esta folha já foi fechada e não muda mais.',
  'introspection.answer.too-long': 'Use no máximo 10.000 caracteres.',
  'introspection.answer.invalid-characters': 'A resposta tem caracteres inválidos.',
  'introspection.week.invalid': 'Essa semana não é válida.',
  'introspection.week.future': 'Só dá para fechar uma semana que já começou.',
};

const INTROSPECTION_FALLBACK_MESSAGES: Readonly<Record<IntrospectionAction, string>> = {
  save: 'Não foi possível salvar a resposta. Tente de novo.',
  close: 'Não foi possível fechar o Introspecto. Tente de novo.',
};

export function introspectionMessage(error: unknown, action: IntrospectionAction): string {
  const fallback = INTROSPECTION_FALLBACK_MESSAGES[action];
  return error instanceof ApiError ? (INTROSPECTION_MESSAGES[error.code] ?? fallback) : fallback;
}

export const LOAD_INTROSPECTION_FAILED_MESSAGE = 'Não foi possível carregar o Introspecto.';
export const CLOSE_UNSAVED_MESSAGE =
  'Não foi possível salvar as respostas, então a folha não foi fechada.';
