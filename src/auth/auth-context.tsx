import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import {
  isAuthConfigured,
  clearStoredSession,
  refreshSession,
  registerWithPassword,
  restoreSession,
  signInWithPassword,
  signOutSession,
  AuthRequestError,
  type AuthSession,
  type AuthUser,
} from './supabase-auth';

type AuthContextValue = {
  configured: boolean;
  isLoading: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  refreshAccessToken: (rejectedAccessToken?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshInFlight = useRef<{ refreshToken: string; promise: Promise<AuthSession> } | null>(null);
  sessionRef.current = session;

  const refreshCurrentSession = useCallback(async (force = false, rejectedAccessToken?: string): Promise<AuthSession | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    // AppState/timer refresh may already have rotated the rejected token.
    if (rejectedAccessToken && current.access_token !== rejectedAccessToken) return current;
    if (refreshInFlight.current?.refreshToken === current.refresh_token) return refreshInFlight.current.promise;

    const promise = refreshSession(current, force).then((refreshed) => {
      if (sessionRef.current?.user.id === current.user.id && sessionRef.current.refresh_token === current.refresh_token) {
        sessionRef.current = refreshed;
        setSession(refreshed);
      }
      return refreshed;
    }).finally(() => {
      if (refreshInFlight.current?.promise === promise) refreshInFlight.current = null;
    });
    refreshInFlight.current = { refreshToken: current.refresh_token, promise };
    return promise;
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!isAuthConfigured) {
      setIsLoading(false);
      return () => { mounted = false; };
    }
    void restoreSession().then((restored) => {
      if (mounted) {
        sessionRef.current = restored;
        setSession(restored);
      }
    }).finally(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const updateSession = async () => {
      try {
        await refreshCurrentSession();
      } catch (error) {
        if (!active) return;
        const definitiveFailure = error instanceof AuthRequestError && [400, 401, 403].includes(error.status);
        if (definitiveFailure && sessionRef.current?.refresh_token === session.refresh_token) {
          sessionRef.current = null;
          setSession(null);
          void clearStoredSession();
        }
        else retryTimer = setTimeout(() => { void updateSession(); }, 30_000);
      }
    };
    const delay = Math.max(1000, session.expires_at * 1000 - Date.now() - 59_000);
    const timer = setTimeout(() => { void updateSession(); }, delay);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void updateSession();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
      subscription.remove();
    };
  }, [refreshCurrentSession, session]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isAuthConfigured,
    isLoading,
    session,
    user: session?.user ?? null,
    async signIn(email, password) {
      const signedIn = await signInWithPassword(email, password);
      sessionRef.current = signedIn;
      setSession(signedIn);
    },
    async register(name, email, password) {
      const result = await registerWithPassword(name, email, password);
      if (result.session) {
        sessionRef.current = result.session;
        setSession(result.session);
      }
      return result.confirmationRequired;
    },
    async refreshAccessToken(rejectedAccessToken) {
      const refreshed = await refreshCurrentSession(true, rejectedAccessToken);
      return refreshed?.access_token ?? null;
    },
    async signOut() {
      const currentSession = session;
      sessionRef.current = null;
      setSession(null);
      if (currentSession) await signOutSession(currentSession);
      else await clearStoredSession();
    },
  }), [isLoading, refreshCurrentSession, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
