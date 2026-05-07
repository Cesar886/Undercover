export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; retryAfter?: number };

function genericErrorFor(status: number): string {
  if (status === 401) return 'Tu sesión expiró';
  if (status === 403) return 'No tienes permiso';
  if (status === 404) return 'No encontrado';
  if (status === 409) return 'Conflicto';
  if (status === 429) return 'Vas muy rápido, espera un momento';
  if (status >= 500) return 'Algo falló del lado del servidor';
  return 'Error inesperado';
}

async function parseResult<T>(res: Response): Promise<ApiResult<T>> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.ok) {
    return { ok: true, data: body as T, status: res.status };
  }

  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

  let error = body?.error;
  if (!error || typeof error !== 'string') error = genericErrorFor(res.status);

  if (res.status === 429 && retryAfter && Number.isFinite(retryAfter)) {
    error = `Vas muy rápido, espera ${retryAfter}s`;
  }

  return { ok: false, error, status: res.status, retryAfter };
}

export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url);
    return parseResult<T>(res);
  } catch {
    return { ok: false, error: 'Sin conexión, revisa tu red', status: 0 };
  }
}

export async function apiPost<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResult<T>(res);
  } catch {
    return { ok: false, error: 'Sin conexión, revisa tu red', status: 0 };
  }
}

export async function apiPatch<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResult<T>(res);
  } catch {
    return { ok: false, error: 'Sin conexión, revisa tu red', status: 0 };
  }
}
