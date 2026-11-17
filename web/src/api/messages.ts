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

export const BLANK_PHASE_NAME_MESSAGE = 'Dê um nome à fase.';

const PHASE_NAME_MESSAGES: Readonly<Record<string, string>> = {
  'phase.name.blank': BLANK_PHASE_NAME_MESSAGE,
  'phase.name.too-long': 'Use no máximo 200 caracteres.',
  'phase.name.invalid-characters': 'O nome tem caracteres inválidos.',
};

export const CREATE_PHASE_FALLBACK_MESSAGE = 'Não foi possível criar a fase. Tente de novo.';
export const RENAME_PHASE_FALLBACK_MESSAGE = 'Não foi possível salvar o nome. Tente de novo.';
export const ARCHIVE_PHASE_FAILED_MESSAGE = 'Não foi possível arquivar a fase. Tente de novo.';
export const DELETE_PHASE_FAILED_MESSAGE = 'Não foi possível excluir a fase. Tente de novo.';

function phaseNameMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? (PHASE_NAME_MESSAGES[error.code] ?? fallback) : fallback;
}

export function createPhaseMessage(error: unknown): string {
  return phaseNameMessage(error, CREATE_PHASE_FALLBACK_MESSAGE);
}

export function renamePhaseMessage(error: unknown): string {
  return phaseNameMessage(error, RENAME_PHASE_FALLBACK_MESSAGE);
}

export function phaseCountSuffix(count: number): string {
  if (count === 0) return '';
  return `, com ${String(count)} ${count === 1 ? 'fase' : 'fases'}`;
}
