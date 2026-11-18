import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { DELETE, GET, PATCH, POST, PUT } from './route';

const upstream = 'http://localhost:8080';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('API proxy', () => {
  it('forwards a GET with its query string and returns the upstream body', async () => {
    server.use(
      http.get(`${upstream}/initiatives`, ({ request }) =>
        HttpResponse.json({ q: new URL(request.url).search }),
      ),
    );

    const response = await GET(new Request('http://web.test/api/initiatives?archived=true'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ q: '?archived=true' });
  });

  it('reads API_URL on every request', async () => {
    vi.stubEnv('API_URL', 'http://api.internal:9000');
    server.use(http.get('http://api.internal:9000/initiatives', () => HttpResponse.json(['ok'])));

    const response = await GET(new Request('http://web.test/api/initiatives'));

    expect(await response.json()).toEqual(['ok']);
  });

  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
  ])('forwards the %s body and content type', async (method, handler) => {
    server.use(
      http.all(`${upstream}/tasks`, async ({ request }) =>
        HttpResponse.json({
          method: request.method,
          type: request.headers.get('content-type'),
          body: await request.json(),
        }),
      ),
    );

    const response = await handler(
      new Request('http://web.test/api/tasks', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Write' }),
      }),
    );

    expect(await response.json()).toEqual({
      method,
      type: 'application/json',
      body: { title: 'Write' },
    });
  });

  it('passes through an empty response with its status', async () => {
    server.use(http.delete(`${upstream}/tasks/1`, () => new HttpResponse(null, { status: 204 })));

    const response = await DELETE(new Request('http://web.test/api/tasks/1', { method: 'DELETE' }));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('passes through error statuses and problem bodies', async () => {
    server.use(
      http.get(`${upstream}/tasks/9`, () =>
        HttpResponse.json(
          { title: 'Not found' },
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    const response = await GET(new Request('http://web.test/api/tasks/9'));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toEqual({ title: 'Not found' });
  });

  it.each([
    ['an absolute upstream URL', `${upstream}/initiatives/42`],
    ['a relative upstream path', '/initiatives/42'],
  ])('rewrites the Location header of %s to the /api prefix', async (_name, location) => {
    server.use(
      http.post(
        `${upstream}/initiatives`,
        () => new HttpResponse(null, { status: 201, headers: { location } }),
      ),
    );

    const response = await POST(new Request('http://web.test/api/initiatives', { method: 'POST' }));

    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBe('/api/initiatives/42');
  });

  it('does not forward the browser host header', async () => {
    server.use(
      http.get(`${upstream}/initiatives`, ({ request }) =>
        HttpResponse.json({ host: request.headers.get('host') }),
      ),
    );

    const response = await GET(
      new Request('http://web.test/api/initiatives', { headers: { host: 'web.test' } }),
    );

    expect(await response.json()).toEqual({ host: 'localhost:8080' });
  });

  it('answers 502 when the API is unreachable', async () => {
    server.use(http.get(`${upstream}/initiatives`, () => HttpResponse.error()));

    const response = await GET(new Request('http://web.test/api/initiatives'));

    expect(response.status).toBe(502);
  });

  it('drops hop-by-hop request headers, including those named in Connection', async () => {
    server.use(
      http.get(`${upstream}/initiatives`, ({ request }) =>
        HttpResponse.json(
          Object.fromEntries(
            ['keep-alive', 'te', 'upgrade', 'expect', 'x-private', 'x-keep'].map((name) => [
              name,
              request.headers.get(name),
            ]),
          ),
        ),
      ),
    );

    const response = await GET(
      new Request('http://web.test/api/initiatives', {
        headers: {
          connection: 'keep-alive, x-private',
          'keep-alive': 'timeout=5',
          te: 'trailers',
          upgrade: 'websocket',
          expect: '100-continue',
          'x-private': 'secret',
          'x-keep': 'yes',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      'keep-alive': null,
      te: null,
      upgrade: null,
      expect: null,
      'x-private': null,
      'x-keep': 'yes',
    });
  });

  it('drops hop-by-hop response headers, including those named in Connection', async () => {
    server.use(
      http.get(
        `${upstream}/initiatives`,
        () =>
          new HttpResponse('[]', {
            headers: {
              connection: 'x-private',
              'keep-alive': 'timeout=5',
              'x-private': 'secret',
              'x-keep': 'yes',
            },
          }),
      ),
    );

    const response = await GET(new Request('http://web.test/api/initiatives'));

    expect(response.headers.get('connection')).toBeNull();
    expect(response.headers.get('keep-alive')).toBeNull();
    expect(response.headers.get('x-private')).toBeNull();
    expect(response.headers.get('x-keep')).toBe('yes');
  });

  it('answers 504 when the API does not answer within 30 seconds', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const expired = new AbortController();
    timeout.mockReturnValue(expired.signal);
    server.use(
      http.get(`${upstream}/initiatives`, async () => {
        await delay('infinite');
        return HttpResponse.json([]);
      }),
    );

    const pending = GET(new Request('http://web.test/api/initiatives'));
    await vi.waitFor(() => {
      expect(timeout).toHaveBeenCalledWith(30_000);
    });
    expired.abort(new DOMException('timed out', 'TimeoutError'));

    expect((await pending).status).toBe(504);
    timeout.mockRestore();
  });

  it('aborts the upstream request when the client disconnects', async () => {
    let upstreamSignal: AbortSignal | undefined;
    server.use(
      http.get(`${upstream}/initiatives`, async ({ request }) => {
        upstreamSignal = request.signal;
        await delay('infinite');
        return HttpResponse.json([]);
      }),
    );
    const client = new AbortController();

    const pending = GET(new Request('http://web.test/api/initiatives', { signal: client.signal }));
    await vi.waitFor(() => {
      expect(upstreamSignal).toBeDefined();
    });
    client.abort();
    await pending;

    expect(upstreamSignal?.aborted).toBe(true);
  });
});
