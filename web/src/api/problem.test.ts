import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './problem';

describe('toApiError', () => {
  it('carries the fields of a problem+json body', () => {
    const error = toApiError(
      {
        type: '/problems/rule-violation',
        title: 'Rule violation',
        status: 400,
        detail: 'Initiative name must not be blank',
        code: 'initiative.name.blank',
      },
      new Response(null, { status: 400 }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      type: '/problems/rule-violation',
      title: 'Rule violation',
      detail: 'Initiative name must not be blank',
      code: 'initiative.name.blank',
      message: 'Initiative name must not be blank',
    });
  });

  it('falls back to the HTTP status when the body is not a problem', () => {
    const error = toApiError('<html>bad gateway</html>', new Response(null, { status: 502 }));

    expect(error).toMatchObject({
      status: 502,
      type: 'about:blank',
      detail: 'HTTP 502',
      code: 'http.502',
    });
  });

  it('ignores a body whose fields have the wrong types or lack a code', () => {
    expect(toApiError({ detail: 42 }, new Response(null, { status: 500 })).code).toBe('http.500');
    expect(
      toApiError(
        { type: 't', title: 'T', status: 400, detail: 'd' },
        new Response(null, { status: 400 }),
      ).code,
    ).toBe('http.400');
  });
});
