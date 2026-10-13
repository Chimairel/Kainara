'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import { ArrowUpRight } from '@/components/ui/icons';
import AuthMascot from '@/components/auth/AuthMascot';
import AuthHeroPanel from '@/components/auth/AuthHeroPanel';
import { SignInPage } from '@/components/ui/sign-in';
import type { UserSession } from '@/lib/context/AuthContext';

const topics = { ACCOUNT: 'Account help', MEALS: 'Meals and planning', GROCERIES: 'Groceries', NOTIFICATIONS: 'Notifications', OTHER: 'Other question or feedback' };

function SupportForm({ user, loading }: { user: UserSession | null; loading: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [category, setCategory] = useState('MEALS');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const submission = useRef<{ key: string; body: string } | null>(null);
  const sending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || loading) return;
    setError('');
    if (!user) { setError('Log in to send your request. Your message is still here.'); return; }
    if (!user.emailVerified) { setError('Verify your email to send your request. Your message is still here.'); return; }
    if (message.trim().length < 20) { setFieldError('Add at least 20 characters so we can understand the problem.'); return; }
    setFieldError(''); sending.current = true; setPending(true);
    const request = new AbortController(); controller.current = request;
    try {
      const body = { category, message: message.trim(), replyEmail: email.trim() };
      const signature = JSON.stringify(body);
      if (submission.current?.body !== signature) submission.current = { key: crypto.randomUUID(), body: signature };
      const response = await api.post('/support/requests', { ...body, requestKey: submission.current.key }, { signal: request.signal });
      if (request.signal.aborted) return;
      if (response.data?.success !== true || response.data?.data?.status !== 'RECORDED' || !response.data.data.reference) throw new Error('Unconfirmed response');
      toast.success('Support request received', {
        description: `We’ll reply to ${email.trim()}. Reference: ${response.data.data.reference}`,
      });
      setMessage(''); submission.current = null;
    } catch (failure) {
      if (request.signal.aborted) return;
      const code = isAxiosError(failure) ? failure.response?.data?.errorCode : '';
      setError(code === 'SUPPORT_RATE_LIMITED' ? 'You’ve sent several requests. Please wait an hour, or email us directly.' :
        code === 'EMAIL_VERIFICATION_REQUIRED' ? 'Verify your email, then send your request again.' :
        'We couldn’t confirm that your request was sent. Your message is still here. Check your connection, or email us directly.');
    } finally {
      sending.current = false;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return <form onSubmit={submit} className="space-y-6" aria-busy={pending || loading}>
    <div className="grid gap-5 sm:grid-cols-2">
      <Input label="Your name" value={user?.name ?? name} onChange={(event) => setName(event.target.value)} readOnly={Boolean(user)} required disabled={loading || pending} autoComplete="name" className="!text-base !backdrop-blur-none" />
      <Input label="Reply email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={254} required disabled={loading || pending} autoComplete="email" className="!text-base !backdrop-blur-none" helperText={user ? "Prefilled from your account. You can choose another reply email." : "Where we can reply."} />
    </div>
    <div>
      <label htmlFor="support-topic" className="mb-2 block text-sm font-semibold">What do you need help with?</label>
      <Dropdown id="support-topic" value={category} onChange={setCategory} disabled={pending || loading} className="w-full !text-base">
        {Object.entries(topics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Dropdown>
    </div>
    <div>
      <label htmlFor="support-message" className="mb-2 block text-sm font-semibold">Your message</label>
      <p id="support-message-help" className="mb-3 text-sm leading-6 text-brand-muted">Include the page, what you expected, and what happened. For account questions or feedback, tell us what you need.</p>
      <textarea id="support-message" value={message} onChange={(event) => { setMessage(event.target.value); setFieldError(''); }}
        required minLength={20} maxLength={4000} rows={6} disabled={pending || loading} aria-invalid={Boolean(fieldError)}
        aria-describedby={`support-message-help${fieldError ? ' support-message-error' : ''}`}
        placeholder="I was on the Groceries page when…"
        className="w-full resize-y rounded-2xl border border-brand-border bg-brand-surface px-4 py-3 text-base leading-7 text-brand-text outline-none placeholder:text-brand-muted disabled:opacity-60" />
      <div className="mt-2 flex items-start justify-between gap-4 text-sm text-brand-muted">
        <p>Keep passwords and medical documents out of this message.</p><span className="shrink-0 tabular-nums">{message.length.toLocaleString()} / 4,000</span>
      </div>
      {fieldError && <p id="support-message-error" role="alert" className="mt-2 text-sm text-status-error-text">{fieldError}</p>}
    </div>
    {error && <div role="alert" className="text-sm leading-6 text-status-error-text"><p>{error}</p>
      {(!user || !user.emailVerified) && <Link href={user ? '/verify-email' : '/login'} className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-green underline underline-offset-4">{user ? 'Verify email' : 'Log in'}</Link>}
    </div>}
    <Button type="submit" isLoading={pending} disabled={loading} className="min-h-12 w-full">Send a support request <ArrowUpRight className="h-4 w-4" /></Button>
  </form>;
}

/** Reuses the auth composition below the public support hero. */
export default function SupportContact() {
  const { user, isLoading } = useAuth();
  return (
    <SignInPage
      embedded
      wide
      title="Send a support request"
      heroContent={<AuthHeroPanel embedded />}
      titleDecoration={<div className="w-[160px] lg:hidden"><AuthMascot size={160} /></div>}
    >
      <SupportForm key={user?.userId ?? 'visitor'} user={user} loading={isLoading} />
    </SignInPage>
  );
}
