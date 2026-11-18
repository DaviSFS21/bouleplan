// Reads API_URL per request: next.config rewrites would freeze it into the build.
const prefix = '/api';
const requestHeadersToDrop = ['host', 'connection', 'content-length', 'transfer-encoding'];
const responseHeadersToDrop = ['content-encoding', 'content-length', 'transfer-encoding'];

function apiOrigin(): string {
  return (process.env.API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
}

function withPrefix(location: string, origin: string): string {
  const target = new URL(location, origin);
  return `${prefix}${target.pathname}${target.search}`;
}

async function proxy(request: Request): Promise<Response> {
  const origin = apiOrigin();
  const incoming = new URL(request.url);
  const target = `${origin}${incoming.pathname.slice(prefix.length)}${incoming.search}`;

  const headers = new Headers(request.headers);
  for (const name of requestHeadersToDrop) headers.delete(name);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of responseHeadersToDrop) responseHeaders.delete(name);
  const location = responseHeaders.get('location');
  if (location) responseHeaders.set('location', withPrefix(location, origin));

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
