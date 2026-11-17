import type { Problem } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string;

  constructor({ status, type, title, detail }: Problem) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.title = title;
    this.detail = detail;
  }
}

function isProblem(body: unknown): body is Problem {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.detail === 'string'
  );
}

export function toApiError(body: unknown, response: Response): ApiError {
  if (isProblem(body)) return new ApiError(body);
  return new ApiError({
    type: 'about:blank',
    title: response.statusText,
    status: response.status,
    detail: `HTTP ${String(response.status)}`,
  });
}
