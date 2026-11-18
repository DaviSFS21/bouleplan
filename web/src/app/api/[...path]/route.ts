// Reads API_URL per request: next.config rewrites would freeze it into the build.
export const dynamic = 'force-dynamic';

const prefix = '/api';
const upstreamTimeoutMs = 30_000;
const hopByHop = [
  'connection',
  'keep-alive',
  'proxy-connection',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'expect',
];
// Both lengths are recomputed by fetch, and the body is already decoded.
const requestOnly = ['host', 'content-length'];
const responseOnly = ['content-encoding', 'content-length'];

function apiOrigin(): string {
  return (process.env.API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
}

function withPrefix(location: string, origin: string): string {
  const target = new URL(location, origin);
  return `${prefix}${target.pathname}${target.search}`;
}

function forwardable(source: Headers, extraDrops: string[]): Headers {
  const headers = new Headers(source);
  const named = (source.get('connection') ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  for (const name of [...hopByHop, ...extraDrops, ...named]) headers.delete(name);
  return headers;
}

async function proxy(request: Request): Promise<Response> {
  const origin = apiOrigin();
  const incoming = new URL(request.url);
  const target = `${origin}${incoming.pathname.slice(prefix.length)}${incoming.search}`;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: forwardable(request.headers, requestOnly),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(upstreamTimeoutMs)]),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return new Response(null, { status: timedOut ? 504 : 502 });
  }

  const headers = forwardable(upstream.headers, responseOnly);
  const location = headers.get('location');
  if (location) headers.set('location', withPrefix(location, origin));

  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
