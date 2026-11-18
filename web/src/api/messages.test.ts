import { describe, expect, it } from 'vitest';
import {
  CREATE_PHASE_FALLBACK_MESSAGE,
  RENAME_PHASE_FALLBACK_MESSAGE,
  createInitiativeMessage,
  createPhaseMessage,
  createTaskMessage,
  CREATE_TASK_FALLBACK_MESSAGE,
  updateTaskMessage,
  phaseCountSuffix,
  renamePhaseMessage,
  updateInitiativeMessage,
  blockerMessage,
  plannerMessage,
  introspectionMessage,
} from './messages';
import { ApiError } from './problem';

function failure(code: string) {
  return new ApiError({
    type: '/problems/rule-violation',
    title: 'Rule violation',
    status: 400,
    detail: 'English detail that must never be shown',
    code,
  });
}

describe('createInitiativeMessage', () => {
  it.each([
    ['initiative.name.blank', 'Dê um nome à iniciativa.'],
    ['initiative.name.too-long', 'Use no máximo 200 caracteres.'],
    ['initiative.name.invalid-characters', 'O nome tem caracteres inválidos.'],
    ['http.500', 'Não foi possível criar a iniciativa. Tente de novo.'],
    ['internal', 'Não foi possível criar a iniciativa. Tente de novo.'],
    ['something.new', 'Não foi possível criar a iniciativa. Tente de novo.'],
  ])('maps %s to its pt-BR message', (code, message) => {
    expect(createInitiativeMessage(failure(code))).toBe(message);
  });

  it('uses the generic message for errors that are not ApiError', () => {
    expect(createInitiativeMessage(new TypeError('fetch failed'))).toBe(
      'Não foi possível criar a iniciativa. Tente de novo.',
    );
  });
});

describe('updateInitiativeMessage', () => {
  it.each([
    ['name', 'initiative.name.blank', 'Dê um nome à iniciativa.'],
    ['name', 'initiative.name.too-long', 'Use no máximo 200 caracteres.'],
    ['name', 'initiative.name.invalid-characters', 'O nome tem caracteres inválidos.'],
    ['description', 'initiative.description.too-long', 'Use no máximo 10.000 caracteres.'],
    [
      'description',
      'initiative.description.invalid-characters',
      'A descrição tem caracteres inválidos.',
    ],
    ['overallDeadline', 'initiative.deadline.invalid', 'Use uma data válida.'],
    ['color', 'initiative.color.invalid', 'Não foi possível salvar. Tente de novo.'],
    ['color', 'initiative.color.required', 'Não foi possível salvar. Tente de novo.'],
    ['overallDeadline', 'http.404', 'Não foi possível salvar. Tente de novo.'],
    ['description', 'initiative.name.blank', 'Não foi possível salvar. Tente de novo.'],
  ] as const)('maps %s / %s to its pt-BR message', (field, code, message) => {
    expect(updateInitiativeMessage(failure(code), field)).toBe(message);
  });

  it('uses the generic message for errors that are not ApiError', () => {
    expect(updateInitiativeMessage(new TypeError('fetch failed'), 'name')).toBe(
      'Não foi possível salvar. Tente de novo.',
    );
  });
});

describe('phase messages', () => {
  it.each([
    ['phase.name.blank', 'Dê um nome à fase.'],
    ['phase.name.too-long', 'Use no máximo 200 caracteres.'],
    ['phase.name.invalid-characters', 'O nome tem caracteres inválidos.'],
    ['http.500', 'Não foi possível criar a fase. Tente de novo.'],
  ])('maps %s when creating', (code, message) => {
    expect(createPhaseMessage(failure(code))).toBe(message);
  });

  it.each([
    ['phase.name.blank', 'Dê um nome à fase.'],
    ['internal', 'Não foi possível salvar o nome. Tente de novo.'],
  ])('maps %s when renaming', (code, message) => {
    expect(renamePhaseMessage(failure(code))).toBe(message);
  });

  it('uses the fallbacks for errors that are not ApiError', () => {
    expect(createPhaseMessage(new TypeError('x'))).toBe(CREATE_PHASE_FALLBACK_MESSAGE);
    expect(renamePhaseMessage(new TypeError('x'))).toBe(RENAME_PHASE_FALLBACK_MESSAGE);
  });

  it.each([
    [0, ''],
    [1, ', com 1 fase'],
    [3, ', com 3 fases'],
  ])('suffixes %s phases as "%s"', (count, suffix) => {
    expect(phaseCountSuffix(count)).toBe(suffix);
  });
});

describe('task messages', () => {
  it.each([
    ['task.title.blank', 'Dê um título à tarefa.'],
    ['task.title.too-long', 'Use no máximo 300 caracteres.'],
    ['task.title.invalid-characters', 'O título tem caracteres inválidos.'],
    ['http.404', CREATE_TASK_FALLBACK_MESSAGE],
  ])('maps %s when creating', (code, message) => {
    expect(createTaskMessage(failure(code))).toBe(message);
  });

  it.each([
    ['title', 'task.title.blank', 'Dê um título à tarefa.'],
    ['title', 'internal', 'Não foi possível salvar o título. Tente de novo.'],
    ['priority', 'task.title.blank', 'Não foi possível mudar a prioridade. Tente de novo.'],
    ['status', 'internal', 'Não foi possível mover a tarefa. Tente de novo.'],
    ['description', 'task.description.too-long', 'Use no máximo 10.000 caracteres.'],
    ['description', 'task.description.invalid-characters', 'A descrição tem caracteres inválidos.'],
    ['deadline', 'task.deadline.invalid', 'Use uma data válida.'],
    [
      'estimatedEffort',
      'task.effort.invalid',
      'Use de 0,01 a 999 horas, com até 2 casas decimais.',
    ],
    ['deadline', 'internal', 'Não foi possível salvar o prazo. Tente de novo.'],
    ['isBlocked', 'internal', 'Não foi possível atualizar o bloqueio. Tente de novo.'],
    ['phaseId', 'http.404', 'Essa fase não existe mais.'],
    ['phaseId', 'internal', 'Não foi possível mudar a fase. Tente de novo.'],
    ['plannedWeekStart', 'task.planned-week.invalid', 'Escolha uma semana válida.'],
    ['plannedWeekStart', 'internal', 'Não foi possível salvar a semana. Tente de novo.'],
  ] as const)('maps %s failures with %s when updating', (field, code, message) => {
    expect(updateTaskMessage(failure(code), field)).toBe(message);
  });

  it('uses the fallbacks for errors that are not ApiError', () => {
    expect(createTaskMessage(new TypeError('x'))).toBe(CREATE_TASK_FALLBACK_MESSAGE);
    expect(updateTaskMessage(new TypeError('x'), 'title')).toBe(
      'Não foi possível salvar o título. Tente de novo.',
    );
  });
});

describe('blockerMessage', () => {
  it.each([
    ['add', 'task.blocker.self', 'Uma tarefa não pode bloquear a si mesma.'],
    ['add', 'task.blocker.cycle', 'Isso criaria um ciclo: a outra tarefa já depende desta.'],
    ['remove', 'http.404', 'Essa tarefa não existe mais.'],
    ['add', 'internal', 'Não foi possível adicionar o bloqueio. Tente de novo.'],
    ['remove', 'internal', 'Não foi possível remover o bloqueio. Tente de novo.'],
  ] as const)('maps %s failures with %s', (action, code, message) => {
    expect(blockerMessage(failure(code), action)).toBe(message);
  });

  it('uses the fallback for errors that are not ApiError', () => {
    expect(blockerMessage(new TypeError('x'), 'add')).toBe(
      'Não foi possível adicionar o bloqueio. Tente de novo.',
    );
  });
});

describe('plannerMessage', () => {
  it.each([
    ['reserve', 'scheduled-item.overlap', 'Já há tempo reservado nesse horário.'],
    ['add-to-list', 'scheduled-item.duplicate', 'Essa tarefa já está na lista desse dia.'],
    ['reserve', 'scheduled-item.task-done', 'Tarefas feitas não vão para a semana.'],
    [
      'move',
      'scheduled-item.time.invalid',
      'Use horários de 15 em 15 minutos, dentro do mesmo dia.',
    ],
    ['create-event', 'calendar-event.title.blank', 'Dê um título ao compromisso.'],
    ['update-event', 'calendar-event.title.too-long', 'Use no máximo 300 caracteres.'],
    [
      'update-event',
      'calendar-event.title.invalid-characters',
      'O título tem caracteres inválidos.',
    ],
    [
      'create-event',
      'calendar-event.time.invalid',
      'Use horários de 15 em 15 minutos, dentro do mesmo dia.',
    ],
    ['remove', 'http.404', 'Esse item não existe mais.'],
    ['add-to-list', 'internal', 'Não foi possível pôr na lista do dia. Tente de novo.'],
    ['reserve', 'internal', 'Não foi possível reservar o tempo. Tente de novo.'],
    ['move', 'internal', 'Não foi possível mover. Tente de novo.'],
    ['resize', 'internal', 'Não foi possível ajustar a duração. Tente de novo.'],
    ['remove', 'internal', 'Não foi possível tirar da agenda. Tente de novo.'],
    ['create-event', 'internal', 'Não foi possível criar o compromisso. Tente de novo.'],
    ['update-event', 'internal', 'Não foi possível salvar o compromisso. Tente de novo.'],
    ['remove-event', 'internal', 'Não foi possível excluir o compromisso. Tente de novo.'],
  ] as const)('maps %s failures with %s', (action, code, message) => {
    expect(plannerMessage(failure(code), action)).toBe(message);
  });

  it('uses the fallback for errors that are not ApiError', () => {
    expect(plannerMessage(new TypeError('x'), 'move')).toBe(
      'Não foi possível mover. Tente de novo.',
    );
  });
});

describe('introspectionMessage', () => {
  it.each([
    ['save', 'introspection.closed', 'Esta folha já foi fechada e não muda mais.'],
    ['close', 'introspection.closed', 'Esta folha já foi fechada e não muda mais.'],
    ['save', 'introspection.answer.too-long', 'Use no máximo 10.000 caracteres.'],
    ['save', 'introspection.answer.invalid-characters', 'A resposta tem caracteres inválidos.'],
    ['close', 'introspection.week.invalid', 'Essa semana não é válida.'],
    ['close', 'introspection.week.future', 'Só dá para fechar uma semana que já começou.'],
    ['save', 'internal', 'Não foi possível salvar a resposta. Tente de novo.'],
    ['close', 'internal', 'Não foi possível fechar o Introspecto. Tente de novo.'],
  ] as const)('maps %s failures with %s', (action, code, message) => {
    expect(introspectionMessage(failure(code), action)).toBe(message);
  });

  it('uses the fallback for errors that are not ApiError', () => {
    expect(introspectionMessage(new TypeError('x'), 'close')).toBe(
      'Não foi possível fechar o Introspecto. Tente de novo.',
    );
  });
});
