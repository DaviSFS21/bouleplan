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
