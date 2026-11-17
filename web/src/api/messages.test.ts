import { describe, expect, it } from 'vitest';
import { createInitiativeMessage } from './messages';
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
