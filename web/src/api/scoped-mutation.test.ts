import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { runScoped } from './scoped-mutation';

function setup() {
  const client = new QueryClient();
  client.setQueryData(['a'], 1);
  client.setQueryData(['b'], 1);
  const gates: (() => void)[] = [];
  const run = (key: string) =>
    runScoped(
      client,
      { scope: 'shared', invalidate: [key] },
      key,
      () =>
        new Promise<string>((resolve) =>
          gates.push(() => {
            resolve(key);
          }),
        ),
      () => undefined,
    );
  const stale = (key: string) => client.getQueryState([key])?.isInvalidated;
  return { run, gates, stale };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('runScoped invalidation', () => {
  it('refreshes a key even when a queued mutation of the scope refreshes another one', async () => {
    const { run, gates, stale } = setup();
    const first = run('a');
    const second = run('b');
    await settle();

    gates[0]?.();
    await first;

    expect(stale('a')).toBe(true);
    expect(stale('b')).toBe(false);
    await settle();
    gates[1]?.();
    await second;
    expect(stale('b')).toBe(true);
  });

  it('waits for the last mutation of the same key before refreshing it', async () => {
    const { run, gates, stale } = setup();
    const first = run('a');
    const second = run('a');
    await settle();

    gates[0]?.();
    await first;
    expect(stale('a')).toBe(false);

    await settle();
    gates[1]?.();
    await second;
    expect(stale('a')).toBe(true);
  });
});
