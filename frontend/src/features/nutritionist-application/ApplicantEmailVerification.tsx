'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';

export default function ApplicantEmailVerification({
  email,
  verified,
  onVerified,
}: {
  email: string;
  verified: boolean;
  onVerified: (email: string, proof: string) => void;
}) {
  const address = email.trim().toLowerCase();
  const currentAddress = useRef(address);
  currentAddress.current = address;
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCode('');
    setSent(false);
    setError(null);
    setCooldown(0);
  }, [address]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function request(verify: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post(
        `/nutritionist-applications/email/${verify ? 'verify' : 'send'}`,
        verify ? { email: address, code } : { email: address }
      );
      if (currentAddress.current !== address) return;
      if (verify) onVerified(address, response.data.data.proof);
      else {
        setSent(true);
        setCode('');
        setCooldown(response.data.data.resendAfterSeconds ?? 60);
      }
    } catch (cause) {
      if (currentAddress.current === address) setError(getApiErrorMessage(cause, 'Email verification failed.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border border-brand-border p-4">
      <p className="text-sm font-semibold">{verified ? 'Email verified' : 'Verify your email address'}</p>
      {verified ? (
        <p role="status" className="text-xs text-brand-green">
          Interview details will be sent to {address}.
        </p>
      ) : (
        <>
          <p className="text-xs text-brand-muted">
            Check the spelling, then enter the six-digit code sent to your inbox. You can use any email provider.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || cooldown > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)}
            onClick={() => void request(false)}
          >
            {cooldown ? `Resend in ${cooldown}s` : sent ? 'Resend code' : 'Send verification code'}
          </Button>
          {sent && (
            <>
              <label className="block text-sm">
                Verification code
                <input
                  aria-label="Verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  className="mt-1 block w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                />
              </label>
              <Button type="button" disabled={busy || code.length !== 6} onClick={() => void request(true)}>
                {busy ? 'Checking…' : 'Verify email'}
              </Button>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </section>
  );
}
