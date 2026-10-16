import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'signal.auth.session.v1';

export const sessionStorage = {
  async read(): Promise<string | null> {
    return SecureStore.getItemAsync(SESSION_KEY);
  },
  async write(value: string): Promise<void> {
    return SecureStore.setItemAsync(SESSION_KEY, value);
  },
  async clear(): Promise<void> {
    return SecureStore.deleteItemAsync(SESSION_KEY);
  },
};
