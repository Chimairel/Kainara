'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import { ArrowUpRight, Mail, CheckCircle } from '@/components/ui/icons';
import AuthMascot from '@/components/auth/AuthMascot';
import type { UserSession } from '@/lib/context/AuthContext';

const supportEmail = 'chimairelp@gmail.com';
const topics = { ACCOUNT: 'Account help', MEALS: 'Meals and planning', GROCERIES: 'Groceries', NOTIFICATIONS: 'Notifications', OTHER: 'Other question or feedback' };

function SupportForm({ user, loading }: { user: UserSession | null; loading: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('MEALS');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [reference, setReference] = useState('');
  const sending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || loading) return;
    setReference(''); setError('');
    if (!user) { setError('Log in to send your request. Your message is still here.'); return; }
    if (!user.emailVerified) { setError('Verify your email to send your request. Your message is still here.'); return; }
    if (message.trim().length < 20) { setFieldError('Add at least 20 characters so we can understand the problem.'); return; }
    setFieldError(''); sending.current = true; setPending(true);
    const request = new AbortController(); controller.current = request;
    try {
      const response = await api.post('/support/requests', { category, message: message.trim() }, { signal: request.signal });
      if (request.signal.aborted) return;
      if (response.data?.success !== true || response.data?.data?.status !== 'ACCEPTED' || !response.data.data.reference) throw new Error('Unconfirmed response');
      setReference(response.data.data.reference); setMessage('');
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
      <Input label="Your name" value={user?.name ?? name} onChange={(event) => setName(event.target.value)} readOnly={Boolean(user)} required disabled={loading || pending} autoComplete="name" className="!text-base" />
      <Input label="Reply email" value={user?.email ?? email} onChange={(event) => setEmail(event.target.value)} type="email" readOnly={Boolean(user)} required disabled={loading || pending} autoComplete="email" className="!text-base" helperText={user ? "We’ll reply to your account email." : "Where we can reply."} />
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
    {reference && <div role="status" className="flex items-start gap-3 text-brand-text">
      <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-brand-green" />
      <div><p className="font-semibold">Support request sent</p><p className="mt-1 text-sm leading-6 text-brand-muted">Our email provider accepted your request. Replies will go to {user?.email}.</p>
        <p className="mt-2 break-all text-xs text-brand-muted">Reference: {reference}</p></div>
    </div>}
    <Button type="submit" isLoading={pending} disabled={loading} className="min-h-12 w-full sm:w-auto">Send a support request <ArrowUpRight className="h-4 w-4" /></Button>
  </form>;
}

/** Adapted from the Contact with Globe composition; existing local Nara replaces the globe. */
export default function SupportContact() {
  const { user, isLoading } = useAuth();
  return <div className="grid gap-10 py-3 lg:gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))' }}>
    <div>
      <h3 className="font-display text-2xl font-bold tracking-tight">Help with your Kainara account</h3>
      <p className="mt-4 max-w-[42ch] text-base leading-7 text-brand-muted">Something isn’t working? Have a question or an idea? Send us the details so we can take a look.</p>
      <a href={`mailto:${supportEmail}`} className="mt-6 inline-flex min-h-11 items-center gap-3 break-all font-semibold text-brand-green underline underline-offset-4"><Mail className="h-5 w-5 shrink-0" />{supportEmail}</a>
      <div className="mt-7 flex items-center gap-5 sm:mt-10"><AuthMascot size={180} /><p className="max-w-[16ch] text-sm leading-6 text-brand-muted">Nara’s here while you write.</p></div>
      <Link href="/docs#faqs" className="mt-6 inline-flex min-h-11 items-center font-semibold text-brand-green underline underline-offset-4">Browse the FAQs</Link>
    </div>
    <div className="min-w-0 rounded-2xl bg-brand-surface p-5 sm:p-8">
      <h3 className="mb-3 font-display text-xl font-bold">Send a support request</h3>
      <p className="mb-7 text-sm leading-6 text-brand-muted">This form sends your message to the Kainara support email.</p>
      <SupportForm key={user?.userId ?? 'visitor'} user={user} loading={isLoading} />
    </div>
  </div>;
}
