import { describe, expect, it } from 'vitest';
import { createInitiativeMessage, updateInitiativeMessage } from './messages';
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
