import { sessionStorage } from './session-storage';

export type AuthUser = {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    location?: string;
    interests?: string[];
    about_me?: string;
    age?: number | null;
    gender?: string;
    occupation?: string;
    [key: string]: unknown;
  };
};

export type AuthProfileFields = {
  full_name: string;
  location: string;
  interests: string[];
  about_me: string;
  age: number | null;
  gender: string;
  occupation: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
};

export class AuthRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfterMs: number | null;

  constructor(status: number, code: string | null, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: AuthUser;
};

type AuthResponse = {
  session: AuthSession | null;
  confirmationRequired: boolean;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isAuthConfigured = Boolean(supabaseUrl && publishableKey);
let inFlightRefresh: { refreshToken: string; promise: Promise<AuthSession> } | null = null;

function authError(message: string): Error {
  return new Error(message);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

async function request<T>(path: string, body?: unknown, accessToken?: string): Promise<T> {
  if (!supabaseUrl || !publishableKey) {
    throw authError('Authentication is not configured. Add the Supabase URL and publishable key to your local .env file.');
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken ?? publishableKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AuthRequestError(0, 'AUTH_NETWORK_ERROR', 'Could not reach the authentication service. Check your connection and try again.');
  }

  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const providerMessage = typeof result.msg === 'string'
      ? result.msg
      : typeof result.message === 'string'
        ? result.message
        : typeof result.error_description === 'string'
          ? result.error_description
          : '';
    const normalized = providerMessage.toLowerCase();
    if (normalized.includes('invalid login credentials')) throw authError('Email or password is incorrect.');
    if (normalized.includes('already registered') || normalized.includes('already been registered')) {
      throw authError('An account with this email may already exist. Try signing in instead.');
    }
    const code = typeof result.error_code === 'string'
      ? result.error_code
      : typeof result.code === 'string'
        ? result.code
        : null;
    throw new AuthRequestError(
      response.status,
      code,
      providerMessage || 'The authentication request could not be completed. Please try again.',
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }
  return result as T;
}

function toSession(response: TokenResponse): AuthSession {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at ?? Math.floor(Date.now() / 1000) + response.expires_in,
    user: {
      id: response.user.id,
      email: response.user.email,
      user_metadata: {
        ...response.user.user_metadata,
        full_name: response.user.user_metadata?.full_name,
        name: response.user.user_metadata?.name,
        location: response.user.user_metadata?.location,
        interests: response.user.user_metadata?.interests,
        about_me: response.user.user_metadata?.about_me,
        age: response.user.user_metadata?.age,
        gender: response.user.user_metadata?.gender,
        occupation: response.user.user_metadata?.occupation,
      },
    },
  };
}

export async function saveSession(session: AuthSession): Promise<AuthSession> {
  await sessionStorage.write(JSON.stringify(session));
  return session;
}

export async function clearStoredSession(): Promise<void> {
  await sessionStorage.clear();
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const response = await request<TokenResponse>('token?grant_type=password', { email, password });
  return saveSession(toSession(response));
}

export async function registerWithPassword(name: string, email: string, password: string, profile: Omit<AuthProfileFields, 'full_name'> = { location: '', interests: [], about_me: '', age: null, gender: '', occupation: '' }): Promise<AuthResponse> {
  const response = await request<TokenResponse & { session?: TokenResponse | null }>('signup', {
    email,
    password,
    data: { full_name: name, ...profile },
  });
  const tokenResponse = response.session ?? (response.access_token ? response : null);
  if (!tokenResponse?.access_token || !tokenResponse.refresh_token) {
    return { session: null, confirmationRequired: true };
  }
  return { session: await saveSession(toSession(tokenResponse)), confirmationRequired: false };
}

export async function updateUserProfile(session: AuthSession, fields: AuthProfileFields): Promise<AuthSession> {
  const metadata = { ...session.user.user_metadata, ...fields };
  const user = await request<AuthUser>('user', { data: metadata }, session.access_token);
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
    throw new AuthRequestError(502, 'INVALID_PROFILE_RESPONSE', 'The profile service returned an invalid account record.');
  }
  if (user.id !== session.user.id) {
    throw new AuthRequestError(401, 'PROFILE_USER_MISMATCH', 'The returned profile does not match the signed-in account.');
  }
  return {
    ...session,
    user: {
      ...session.user,
      ...user,
      user_metadata: { ...metadata, ...user.user_metadata },
    },
  };
}

async function refresh(session: AuthSession): Promise<AuthSession> {
  const response = await request<TokenResponse>('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
  return saveSession(toSession(response));
}

async function validateStoredSession(session: AuthSession): Promise<void> {
  const user = await request<AuthUser>('user', undefined, session.access_token);
  if (user.id !== session.user.id) {
    throw new AuthRequestError(401, 'SESSION_USER_MISMATCH', 'The stored session no longer matches its account.');
  }
}

function isDefinitiveSessionFailure(error: unknown): boolean {
  return error instanceof AuthRequestError && [400, 401, 403].includes(error.status);
}

export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const rawSession = await sessionStorage.read();
    if (!rawSession) return null;
    const stored = JSON.parse(rawSession) as AuthSession;
    if (!stored.access_token || !stored.refresh_token || !stored.user?.id) throw new Error('Invalid saved session');
    if (stored.expires_at > Math.floor(Date.now() / 1000) + 60) {
      try {
        await validateStoredSession(stored);
        return stored;
      } catch (validationError) {
        if (!isDefinitiveSessionFailure(validationError)) return null;
      }
    }
    try {
      return await refresh(stored);
    } catch (refreshError) {
      if (isDefinitiveSessionFailure(refreshError)) {
        await clearStoredSession();
        return null;
      }
      // Keep the persisted record for a later retry, but don't treat it as validated.
      return null;
    }
  } catch {
    try { await sessionStorage.clear(); } catch { /* Storage will be retried on the next launch. */ }
    return null;
  }
}

export async function refreshSession(session: AuthSession, force = false): Promise<AuthSession> {
  if (!force && session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  if (inFlightRefresh?.refreshToken === session.refresh_token) return inFlightRefresh.promise;
  const promise = refresh(session).finally(() => {
    if (inFlightRefresh?.promise === promise) inFlightRefresh = null;
  });
  inFlightRefresh = { refreshToken: session.refresh_token, promise };
  return promise;
}

export async function signOutSession(session: AuthSession): Promise<void> {
  try {
    await request<void>('logout', {}, session.access_token);
  } finally {
    await clearStoredSession();
  }
}
