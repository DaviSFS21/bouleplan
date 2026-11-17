import { describe, expect, it } from 'vitest';
import { initiative, phase, task } from '@/test/fixtures';
import {
  progressByInitiative,
  progressByPhase,
  statusTitle,
  tasksIn,
  visibleTasks,
} from './task-filter';

const reforma = initiative();
const horta = initiative({ id: '22222222-2222-4222-8222-222222222222' });
const piso = phase();
const sem = task({ id: 'a' });
const noPiso = task({ id: 'b', phaseId: piso.id, status: 'done' });
const naHorta = task({ id: 'c', initiativeId: horta.id, status: 'done' });
const all = [sem, noPiso, naHorta];

describe('visibleTasks', () => {
  it('shows everything without a selection', () => {
    expect(visibleTasks(all, null, null)).toEqual(all);
  });

  it('shows every phase of the initiative, implicit included', () => {
    expect(visibleTasks(all, reforma, null).map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('shows only the phase when one is filtered', () => {
    expect(visibleTasks(all, reforma, piso).map(({ id }) => id)).toEqual(['b']);
  });
});

describe('tasksIn', () => {
  it('keeps the column state and sorts by the API order', () => {
    const urgent = task({ id: 'u', priority: 'P1' });

    expect(tasksIn([sem, urgent, noPiso], 'to_do').map(({ id }) => id)).toEqual(['u', 'a']);
  });
});

describe('progress', () => {
  it('counts done and total per initiative', () => {
    const progress = progressByInitiative(all);

    expect(progress.get(reforma.id)).toEqual({ done: 1, total: 2 });
    expect(progress.get(horta.id)).toEqual({ done: 1, total: 1 });
  });

  it('counts per named phase and ignores the implicit one', () => {
    const progress = progressByPhase(all);

    expect(progress.get(piso.id)).toEqual({ done: 1, total: 1 });
    expect(progress.size).toBe(1);
  });

  it('is empty while the tasks load', () => {
    expect(progressByInitiative(undefined).size).toBe(0);
  });
});

describe('statusTitle', () => {
  it('words the three states in Portuguese', () => {
    expect(['to_do', 'in_progress', 'done'].map((status) => statusTitle(status as 'done'))).toEqual(
      ['A fazer', 'Em andamento', 'Feito'],
    );
  });
});
