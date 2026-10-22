import * as SecureStore from 'expo-secure-store';
import { createApiClient, type Vault } from './api-client';
import { resolveApiUrl } from './policies';
import type { Tokens } from './contracts';

const key = 'kainara.mobile.session.v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const vault: Vault = {
  async read() {
    const value = await SecureStore.getItemAsync(key, options);
    if (!value) return null;
    try {
      const data = JSON.parse(value) as Tokens;
      if (typeof data.accessToken === 'string' && typeof data.refreshToken === 'string') return data;
    } catch {
      /* Invalid local credentials must never become an authenticated session. */
    }
    await SecureStore.deleteItemAsync(key, options);
    return null;
  },
  write: (value) => SecureStore.setItemAsync(key, JSON.stringify(value), options),
  clear: () => SecureStore.deleteItemAsync(key, options),
};
export let configurationError: string | null = null;
let baseUrl = '';
try {
  baseUrl = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);
} catch (error) {
  configurationError = error instanceof Error ? error.message : 'Configure the API URL.';
}
// No production default: opening a development client must not query demo.
export const api = createApiClient(baseUrl, vault);
export { ApiError } from './api-client';
