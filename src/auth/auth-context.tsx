import { AppState } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  isAuthConfigured,
  refreshSession,
  registerWithPassword,
  restoreSession,
  signInWithPassword,
  signOutSession,
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!isAuthConfigured) {
      setIsLoading(false);
      return () => { mounted = false; };
    }
    void restoreSession().then((restored) => {
      if (mounted) setSession(restored);
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
        const refreshed = await refreshSession(session);
        if (active && refreshed !== session) setSession(refreshed);
      } catch {
        if (!active) return;
        if (session.expires_at * 1000 <= Date.now()) setSession(null);
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
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isAuthConfigured,
    isLoading,
    session,
    user: session?.user ?? null,
    async signIn(email, password) {
      setSession(await signInWithPassword(email, password));
    },
    async register(name, email, password) {
      const result = await registerWithPassword(name, email, password);
      if (result.session) setSession(result.session);
      return result.confirmationRequired;
    },
    async signOut() {
      const currentSession = session;
      setSession(null);
      if (currentSession) await signOutSession(currentSession);
    },
  }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
