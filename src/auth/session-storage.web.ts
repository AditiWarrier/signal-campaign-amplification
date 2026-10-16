const SESSION_KEY = 'signal.auth.session.v1';

export const sessionStorage = {
  async read(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(SESSION_KEY) ?? null;
    } catch {
      return null;
    }
  },
  async write(value: string): Promise<void> {
    globalThis.localStorage?.setItem(SESSION_KEY, value);
  },
  async clear(): Promise<void> {
    globalThis.localStorage?.removeItem(SESSION_KEY);
  },
};
