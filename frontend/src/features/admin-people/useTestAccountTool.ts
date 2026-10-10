'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { defaultTestMemberProfile, type TestMemberProfileOptions } from './test-member-profile';

export interface TestAccountOptions {
  set: string;
  name: string;
  emailName: string;
  role: 'USER' | 'RND' | 'ADMIN';
  count: number;
  conditions: string[];
  allergens: string[];
  rndStatus: string;
  profile: TestMemberProfileOptions;
}
export interface TestAccountRow {
  id: string;
  email: string;
  name: string;
  role: string;
  exists: boolean;
}
interface Capabilities {
  available: boolean;
  target?: string;
  conditions?: string[];
  allergens?: string[];
}
interface Preview {
  target: string;
  accounts: TestAccountRow[];
  previewToken: string;
}
interface Result {
  accounts: TestAccountRow[];
  newAccountPassword: string | null;
}
const defaults = (): TestAccountOptions => ({
  set: '',
  name: 'Test Member',
  emailName: '',
  role: 'USER',
  count: 1,
  conditions: ['NONE'],
  allergens: ['NONE'],
  rndStatus: 'ACTIVE',
  profile: defaultTestMemberProfile(),
});
function requestError(error: unknown) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Request failed. Try again.';
}
export function useTestAccountTool(active: boolean, onCreated: () => void) {
  const { user } = useAuth();
  const query = useSessionQuery<Capabilities>({
    ownerId: user?.userId,
    enabled: active,
    resource: 'admin-test-account-capabilities',
    errorMessage: 'Test account tools are unavailable.',
    fetcher: async () => (await api.get('/admin/test-accounts')).data.data,
  });
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(defaults);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<TestAccountOptions>) => {
    setOptions((current) => {
      const next = { ...current, ...patch };
      next.profile = { ...next.profile };
      if (next.profile.goal === 'MAINTAIN') next.profile.targetWeightKg = next.profile.weightKg;
      if (next.conditions.includes('PREGNANT')) next.profile.biologicalSex = 'FEMALE';
      return next;
    });
    setPreview(null);
    setConfirmed(false);
    setError(null);
  };
  const close = () => {
    if (!busy) {
      setOpen(false);
      setResult(null);
      setPreview(null);
    }
  };
  const start = () => {
    setOptions(defaults());
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
    setOpen(true);
  };
  const inspect = async () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    setConfirmed(false);
    try {
      setPreview((await api.post('/admin/test-accounts/preview', requestOptions())).data.data);
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!preview || !confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post(
        '/admin/test-accounts',
        { ...requestOptions(), previewToken: preview.previewToken, confirmedTarget: true },
        { timeout: 90_000 }
      );
      setResult(response.data.data);
      setPreview(null);
      onCreated();
    } catch (failure) {
      setError(requestError(failure));
      setPreview(null);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  };
  const requestOptions = () => {
    const { profile, emailName, ...request } = options;
    const identity = emailName.trim() ? { emailName: emailName.trim() } : {};
    return options.role === 'USER' ? { ...request, ...identity, profile } : { ...request, ...identity };
  };
  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        result.accounts
          .map(
            (account) =>
              `${account.email} | ${account.role} | ${account.exists ? 'Existing password unchanged' : result.newAccountPassword}`
          )
          .join('\n')
      );
    } catch {
      setError('Clipboard unavailable. Copy the email and password from this dialog.');
    }
  };
  return {
    capabilities: query.data,
    open,
    options,
    preview,
    result,
    confirmed,
    busy,
    error,
    update,
    close,
    start,
    inspect,
    create,
    copy,
    setConfirmed,
  };
}
