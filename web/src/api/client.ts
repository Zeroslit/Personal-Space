import type { ApiErrorBody } from './types';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    let code = 'http_error';
    let message = `请求失败（HTTP ${response.status}）`;
    if (text) {
      try {
        const parsed = JSON.parse(text) as Partial<ApiErrorBody>;
        if (typeof parsed.message === 'string' && parsed.message) message = parsed.message;
        if (typeof parsed.error === 'string' && parsed.error) code = parsed.error;
      } catch {
        message = text.slice(0, 200);
      }
    }
    throw new ApiRequestError(response.status, code, message);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get<T>(url: string, signal?: AbortSignal): Promise<T> {
    return fetch(url, { headers: { Accept: 'application/json' }, signal }).then((r) => parse<T>(r));
  },
  post<T>(url: string, body?: unknown): Promise<T> {
    return fetch(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => parse<T>(r));
  },
  put<T>(url: string, body: unknown): Promise<T> {
    return fetch(url, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) }).then((r) =>
      parse<T>(r),
    );
  },
  patch<T>(url: string, body: unknown): Promise<T> {
    return fetch(url, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }).then((r) =>
      parse<T>(r),
    );
  },
  delete<T>(url: string): Promise<T> {
    return fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } }).then((r) => parse<T>(r));
  },
  uploadAsset(file: File): Promise<unknown> {
    return fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    }).then((r) => parse<unknown>(r));
  },
};
