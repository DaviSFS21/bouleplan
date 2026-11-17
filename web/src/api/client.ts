import createClient from 'openapi-fetch';
import { toApiError } from './problem';
import type { paths } from './schema';

export const api = createClient<paths>({ baseUrl: '/api' });

export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) throw toApiError(error, response);
  return data as T;
}
