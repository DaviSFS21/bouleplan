import { afterEach, describe, expect, it, vi } from 'vitest';
import { rememberInitiativeId, rememberedInitiativeId } from './quick-initiative';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('quick-create initiative memory', () => {
  it('returns nothing before anything was chosen', () => {
    expect(rememberedInitiativeId()).toBeNull();
  });

  it('remembers the last choice', () => {
    rememberInitiativeId('abc');

    expect(rememberedInitiativeId()).toBe('abc');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(rememberedInitiativeId()).toBeNull();
    expect(() => {
      rememberInitiativeId('abc');
    }).not.toThrow();
  });
});
