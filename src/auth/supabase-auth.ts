import { sessionStorage } from './session-storage';

export type AuthUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string; name?: string };
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
};

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

function authError(message: string): Error {
  return new Error(message);
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
    throw authError('Could not reach the authentication service. Check your connection and try again.');
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
    throw authError(providerMessage || 'The authentication request could not be completed. Please try again.');
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
        full_name: response.user.user_metadata?.full_name,
        name: response.user.user_metadata?.name,
      },
    },
  };
}

async function saveSession(session: AuthSession): Promise<AuthSession> {
  await sessionStorage.write(JSON.stringify(session));
  return session;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const response = await request<TokenResponse>('token?grant_type=password', { email, password });
  return saveSession(toSession(response));
}

export async function registerWithPassword(name: string, email: string, password: string): Promise<AuthResponse> {
  const response = await request<TokenResponse & { session?: TokenResponse | null }>('signup', {
    email,
    password,
    data: { full_name: name },
  });
  const tokenResponse = response.session ?? (response.access_token ? response : null);
  if (!tokenResponse?.access_token || !tokenResponse.refresh_token) {
    return { session: null, confirmationRequired: true };
  }
  return { session: await saveSession(toSession(tokenResponse)), confirmationRequired: false };
}

async function refresh(session: AuthSession): Promise<AuthSession> {
  const response = await request<TokenResponse>('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
  return saveSession(toSession(response));
}

export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const rawSession = await sessionStorage.read();
    if (!rawSession) return null;
    const stored = JSON.parse(rawSession) as AuthSession;
    if (!stored.access_token || !stored.refresh_token || !stored.user?.id) throw new Error('Invalid saved session');
    if (stored.expires_at > Math.floor(Date.now() / 1000) + 60) return stored;
    try {
      return await refresh(stored);
    } catch {
      // Keep an unexpired session available during a brief network outage.
      if (stored.expires_at > Math.floor(Date.now() / 1000)) return stored;
      return null;
    }
  } catch {
    try { await sessionStorage.clear(); } catch { /* Storage will be retried on the next launch. */ }
    return null;
  }
}

export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  return refresh(session);
}

export async function signOutSession(session: AuthSession): Promise<void> {
  try {
    await request<void>('logout', {}, session.access_token);
  } finally {
    await sessionStorage.clear();
  }
}
