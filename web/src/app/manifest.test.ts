import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('manifest', () => {
  it('names the app and points at the two app icons, any and maskable', () => {
    const result = manifest();

    expect(result.name).toBe('Bouléplan');
    expect(result.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]);
  });
});
