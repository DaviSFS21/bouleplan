import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLeft, saveLeft } from './left-store';

const KEY = 'bouleplan.introspecto.leftBehind.2026-11-16';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('left-behind store', () => {
  it('round-trips the ids of a week, apart from other weeks', () => {
    saveLeft('2026-11-16', new Set(['a', 'b']));
    saveLeft('2026-11-09', new Set(['c']));

    expect(loadLeft('2026-11-16', new Set(['a', 'b', 'c']))).toEqual(new Set(['a', 'b']));
  });

  it('keeps only the ids that are still tasks', () => {
    saveLeft('2026-11-16', new Set(['a', 'gone']));

    expect(loadLeft('2026-11-16', new Set(['a']))).toEqual(new Set(['a']));
  });

  it('starts empty with nothing stored, bad JSON or the wrong shape', () => {
    expect(loadLeft('2026-11-16', new Set(['a']))).toEqual(new Set());
    localStorage.setItem(KEY, '{oops');
    expect(loadLeft('2026-11-16', new Set(['a']))).toEqual(new Set());
    localStorage.setItem(KEY, '{"a":1}');
    expect(loadLeft('2026-11-16', new Set(['a']))).toEqual(new Set());
    localStorage.setItem(KEY, '[1,"a"]');
    expect(loadLeft('2026-11-16', new Set(['a']))).toEqual(new Set(['a']));
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(loadLeft('2026-11-16', new Set(['a']))).toEqual(new Set());
    expect(() => {
      saveLeft('2026-11-16', new Set(['a']));
    }).not.toThrow();
  });
});
