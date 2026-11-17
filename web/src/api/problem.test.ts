import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './problem';

describe('toApiError', () => {
  it('carries the fields of a problem+json body', () => {
    const error = toApiError(
      {
        type: '/problems/invalid-initiative',
        title: 'Invalid initiative',
        status: 400,
        detail: 'Name must not be blank',
      },
      new Response(null, { status: 400 }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      type: '/problems/invalid-initiative',
      title: 'Invalid initiative',
      detail: 'Name must not be blank',
      message: 'Name must not be blank',
    });
  });

  it('falls back to the HTTP status when the body is not a problem', () => {
    const error = toApiError('<html>bad gateway</html>', new Response(null, { status: 502 }));

    expect(error).toMatchObject({ status: 502, type: 'about:blank', detail: 'HTTP 502' });
  });

  it('ignores a body whose fields have the wrong types', () => {
    const error = toApiError({ detail: 42 }, new Response(null, { status: 500 }));

    expect(error.detail).toBe('HTTP 500');
  });
});
