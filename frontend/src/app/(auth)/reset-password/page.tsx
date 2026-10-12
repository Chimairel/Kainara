'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import PasswordInput from '@/components/ui/PasswordInput';
import HydratedForm from '@/components/auth/HydratedForm';
import AuthShell from '@/components/auth/AuthShell';
import { passwordSchema } from '@/validation/auth.schemas';

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) return setError('Invalid reset link. Please request a new password reset.');
    if (!password || !confirmPassword) return setError('Please fill in all fields.');
    const validation = passwordSchema.safeParse(password);
    if (!validation.success) return setError(validation.error.issues[0].message);
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <FeedbackNotice>
          <span>Invalid or missing reset token. Please request a new password reset.</span>
        </FeedbackNotice>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex text-sm font-bold text-brand-green transition hover:text-brand-cyan"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 text-brand-green shadow-cyan">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <p className="mt-5 text-sm leading-6 text-brand-muted">
          Your password was reset successfully. Your nutrition data and account settings were not changed.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-[#07100d] shadow-neon"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <FeedbackNotice className="mb-5">
          <span>{error}</span>
        </FeedbackNotice>
      )}
      <HydratedForm onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PasswordInput
          id="new-password"
          name="newPassword"
          label="New password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
        <PasswordInput
          id="confirm-password"
          name="confirmPassword"
          label="Confirm password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
          error={passwordsMismatch ? 'Passwords do not match.' : undefined}
        />
        <p className="text-[11px] leading-5 text-brand-muted">
          Use at least 8 characters with one uppercase letter and one number.
        </p>
        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
          Reset password
        </Button>
      </HydratedForm>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Secure reset"
      title="Choose a new password"
      heroTitle={
        <>
          Restore access.
          <br />
          <span className="text-brand-accent">Keep your momentum.</span>
        </>
      }
      heroDescription="Your plan history and health context stay connected while your account credentials are securely refreshed."
      footer={
        <Link href="/login" className="font-bold text-brand-green transition hover:text-brand-cyan">
          Return to sign in
        </Link>
      }
    >
      <Suspense fallback={<div className="py-8 text-center text-sm text-brand-muted">Preparing secure reset...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
