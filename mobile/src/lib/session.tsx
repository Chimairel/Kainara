import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, ApiError, configurationError } from './client';
import type { MemberProfile } from './contracts';

type Session = {
  profile: MemberProfile | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  signIn(email: string, password: string, name?: string): Promise<void>;
  signOut(): Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(configurationError);
  const generation = useRef(0);
  const invalidateRequests = useCallback(() => {
    generation.current += 1;
  }, []);
  const request = useRef<Promise<void> | null>(null);
  const load = useCallback(async () => {
    const revision = generation.current;
    const response = await api.request<MemberProfile>('/user/profile');
    if (
      !response.data?.id ||
      typeof response.data.emailVerified !== 'boolean' ||
      typeof response.data.onboardingDone !== 'boolean'
    )
      throw new Error('Could not verify your account state. Try again.');
    if (generation.current === revision) {
      setProfile(response.data);
      setError(null);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (request.current) return request.current;
    request.current = load().finally(() => {
      request.current = null;
    });
    return request.current;
  }, [load]);
  const bootstrap = useCallback(async () => {
    if (configurationError) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (await api.restore()) await refresh();
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 401)) setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    api.setExpiredHandler(() => {
      generation.current++;
      setProfile(null);
    });
    void Promise.resolve().then(bootstrap);
    // This ref is a monotonic request generation, not a mounted DOM/native node.
    return () => {
      api.setExpiredHandler(() => {});
      invalidateRequests();
    };
  }, [bootstrap, invalidateRequests]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && profile) {
        setLoading(true);
        void refresh()
          .catch((cause) => setError(message(cause)))
          .finally(() => setLoading(false));
      }
    });
    return () => listener.remove();
  }, [profile, refresh]);
  return (
    <Context.Provider
      value={{
        profile,
        loading,
        error,
        refresh: async () => {
          if (!profile) await bootstrap();
          else await refresh();
        },
        signIn: async (email, password, name) => {
          if (configurationError) throw new Error(configurationError);
          generation.current++;
          setProfile(null);
          setError(null);
          await api.signIn(name ? '/auth/mobile/register' : '/auth/mobile/login', {
            email,
            password,
            ...(name ? { name } : {}),
          });
          await refresh();
        },
        signOut: async () => {
          await api.signOut();
          setProfile(null);
          setError(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const state = useContext(Context);
  if (!state) throw new Error('SessionProvider is required.');
  return state;
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
