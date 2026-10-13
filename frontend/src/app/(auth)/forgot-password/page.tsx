'use client';
import { toast } from 'sonner';
import { showSubmissionError } from '@/lib/submission-attempts';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import HydratedForm from '@/components/auth/HydratedForm';
import AuthShell from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    submitting.current = true;
    setIsLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data?.success !== true) throw new Error('Unconfirmed password recovery');
      toast.success('Check your inbox', { description: 'If that account supports password sign-in, we’ve sent a reset link. Google-only accounts continue using Google sign-in.' });
    } catch (err) {
      showSubmissionError(err, 'Something went wrong. Please try again.');
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your access"
      heroTitle={
        <>
          A secure route
          <br />
          <span className="text-brand-accent">back to your plan.</span>
        </>
      }
      heroDescription="Account recovery is kept separate from your health profile and does not change your saved nutrition data."
      footer={
        <Link href="/login" className="font-bold text-brand-green transition hover:text-brand-cyan">
          Return to sign in
        </Link>
      }
    >
      <HydratedForm onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="forgot-email"
          label="Email address"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
          required
          error={error ?? undefined}
          autoComplete="email"
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
          Send reset link
        </Button>
      </HydratedForm>
    </AuthShell>
  );
}
