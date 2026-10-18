type RestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type SupabaseRestOptions = {
  accessToken?: string;
  method?: RestMethod;
  query?: Record<string, string>;
  body?: unknown;
  prefer?: string;
};

export class SupabaseRestError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(`Supabase data request failed (HTTP ${status}${code ? `, ${code}` : ''}).`);
    this.name = 'SupabaseRestError';
  }
}

/** Calls a single exposed PostgREST resource using the app's existing session token. */
export async function requestSupabaseRest<T>(resource: string, options: SupabaseRestOptions): Promise<T> {
  if (!/^signal_[a-z_]+$/.test(resource)) {
    throw new Error('Only SIGNAL campaign resources may be requested through this helper.');
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase database access is not configured.');
  }

  const query = new URLSearchParams(options.query).toString();
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}${query ? `?${query}` : ''}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${options.accessToken ?? publishableKey}`,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as { code?: unknown };
    throw new SupabaseRestError(response.status, typeof errorBody.code === 'string' ? errorBody.code : undefined);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
