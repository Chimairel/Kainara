'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import NaraPortrait from './NaraPortrait';
import { ArrowUpRight, BookOpen, MessageSquare, Plus, Soup, X } from '@/components/ui/icons';
import AssistantComposer from './AssistantComposer';
import type { MemberAssistantModel } from './useMemberAssistant';
import type { AssistantReply } from './types';

const quickActions = [
  { action: undefined, label: 'About KAINARA', icon: BookOpen },
  { action: 'FIND_MEAL' as const, label: 'Find a meal', icon: Soup },
  { action: 'TODAY' as const, label: 'Today’s nutrition', icon: MessageSquare },
  { action: 'GUIDANCE' as const, label: 'My nutrition guidance', icon: BookOpen },
];
const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-muted transition-colors hover:bg-brand-bgAlt hover:text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green disabled:opacity-40';

function TypingDots({ label }: { label: string }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const update = () => setPaused(document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <span role="status" className="inline-flex min-h-6 items-center">
    <span className="sr-only">{label}</span>
    <span aria-hidden="true" className="inline-flex items-center gap-1.5">
      {[0, 1, 2].map(index => <span key={index} data-nara-typing-dot
        className="inline-block h-1.5 w-1.5 rounded-full bg-brand-muted motion-safe:animate-bounce"
        style={{ animationDelay: `${index * 160}ms`, animationPlayState: paused ? 'paused' : 'running' }} />)}
    </span>
  </span>;
}

function ReplyText({ text, links, onNavigate }: { text: string; links?: AssistantReply['links']; onNavigate?: () => void }) {
  const inline = links?.filter(link => link.label && text.includes(link.label) && /^\/(?!\/)/u.test(link.href)) ?? [];
  if (!inline.length) return <>{text}</>;
  const pattern = new RegExp(`(${inline.map(link => link.label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).sort((a, b) => b.length - a.length).join('|')})`, 'gu');
  return <>{text.split(pattern).map((part, index) => {
    const link = inline.find(item => item.label === part);
    return link ? <Link key={index} href={link.href} onClick={onNavigate}
      className="rounded font-semibold text-brand-green underline decoration-brand-green/60 underline-offset-4 hover:decoration-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green">{part}</Link> : part;
  })}</>;
}

function ReplyDetails({ reply, onNavigate }: { reply: AssistantReply; onNavigate?: () => void }) {
  const fact = (item: { label: string; value: string }) => <div key={item.label} className="min-w-0">
    <dt className="text-xs text-brand-muted">{item.label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold tabular-nums">{item.value}</dd>
  </div>;
  return <>
    {reply.facts?.length ? <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-brand-border py-4">
      {reply.facts.slice(0, 4).map(fact)}
    </dl> : null}
    {reply.facts && reply.facts.length > 4 ? <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer rounded text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green">More recorded facts</summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">{reply.facts.slice(4).map(fact)}</dl>
    </details> : null}
    {reply.meals?.map(meal => <article key={meal.id} className="mt-4 border-t border-brand-border pt-4">
      <h3 className="font-display text-base font-semibold">{meal.name}</h3>
      <p className="mt-1 text-xs leading-5 text-brand-muted tabular-nums">{meal.calories.toFixed(1)} kcal · {meal.proteinG.toFixed(1)} g protein</p>
      <details className="mt-2 text-sm">
        <summary className="w-fit cursor-pointer rounded text-brand-green underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green">View meal</summary>
        <p className="mt-2 text-xs leading-5 text-brand-muted tabular-nums">{meal.carbsG.toFixed(1)} g carbs · {meal.fatG.toFixed(1)} g fat</p>
        <p className="mt-2 text-xs leading-5">{meal.ingredients.join(', ')}</p>
      </details>
    </article>)}
    {reply.references?.length ? <details className="mt-4 text-xs text-brand-muted">
      <summary className="w-fit cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green">Sources</summary>
      <ul className="mt-2 space-y-2">{reply.references.filter(item => item.href.startsWith('https://')).map(item => <li key={item.href}>
        <a href={item.href} target="_blank" rel="noopener noreferrer" className="break-words text-brand-green underline underline-offset-4">{item.label}</a>
      </li>)}</ul>
    </details> : null}
    {reply.links?.filter(link => !link.label || !reply.text.includes(link.label)).map(link => <Link key={link.href} href={link.href} onClick={onNavigate} className="mt-4 inline-flex min-h-10 items-center gap-1 rounded text-sm font-semibold text-brand-green underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green">
      {link.label}<ArrowUpRight className="h-4 w-4" />
    </Link>)}
    <p className="mt-3 text-[11px] text-brand-muted">{reply.source === 'AI' ? 'AI assisted · 1 credit used' : 'System response · No credit used'}</p>
  </>;
}

export default function AssistantConversation({ model, titleId, member, modal = false }: {
  model: MemberAssistantModel; titleId: string; member?: { name: string; image?: string | null }; modal?: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  const confirmation = useRef<HTMLElement>(null);
  const followReply = useRef(true);
  useEffect(() => {
    followReply.current = true;
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [model.messages, model.busy, model.pending, model.error]);
  useEffect(() => {
    if (followReply.current) end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [model.typingReply]);
  useEffect(() => { if (model.pending && !model.busy) confirmation.current?.focus(); }, [model.pending, model.busy]);
  const reset = model.allowance ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(model.allowance.resetsAt)) : '';
  const disabled = model.busy || Boolean(model.pending) || Boolean(model.recoveryKey);
  const composerDisabled = model.busy || Boolean(model.recoveryKey);
  const sendBlocked = disabled || Boolean(model.typingReply);
  const mood = model.busy ? 'thinking' : model.error || (model.pending && model.allowance?.remaining === 0) ? 'failed' : 'front';
  return <div className="flex h-full min-h-0 flex-col bg-brand-surface text-brand-text">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-brand-border px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <NaraPortrait mood={mood} size={48} />
        <div className="min-w-0">{modal
        ? <Dialog.Title className="font-display text-lg font-semibold">Nara</Dialog.Title>
        : <h2 id={titleId} className="font-display text-lg font-semibold">Nara</h2>}
        <p className="mt-0.5 text-xs text-brand-muted">Your nutrition companion</p></div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" className={iconButton} aria-label="New chat" title="New chat" onClick={model.newChat} disabled={model.busy || Boolean(model.typingReply)}><Plus className="h-5 w-5" /></button>
        <button type="button" className={iconButton} aria-label="Close assistant" title="Close assistant" onClick={() => model.setOpen(false)}><X className="h-5 w-5" /></button>
      </div>
    </header>
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6"
      onScroll={event => { const node = event.currentTarget; followReply.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48; }}>
      {!model.messages.length ? <div className="flex min-h-60 flex-col justify-center pb-8">
        <h3 className="font-display text-2xl font-semibold leading-tight">What would help<br />with your next meal?</h3>
        <p className="mt-3 text-sm leading-6 text-brand-muted">App help and saved-information shortcuts are free. For an AI reply, type /ai, select it with Tab or Enter, then write your question. I’ll ask before using 1 credit.</p>
        <div className="mt-6 flex flex-col gap-2">{quickActions.map(({ action, label, icon: Icon }) => <button key={label} type="button" disabled={sendBlocked}
          onClick={() => model.send(action, label)} className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-border px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-brand-bgAlt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green disabled:opacity-40">
          <Icon className="h-4 w-4 text-brand-green" />{label}<ArrowUpRight className="ml-auto h-4 w-4 text-brand-muted" />
        </button>)}</div>
      </div> : <>
        <div role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions" className="space-y-6">
          {model.messages.map(message => <div key={message.id} className={`flex items-end gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {message.role === 'user'
              ? <Avatar src={member?.image} name={member?.name ?? 'You'} alt="" size="sm" aria-hidden="true" className="!h-8 !w-8 !text-[10px]" />
              : <NaraPortrait size={32} />}
            <div className={`min-w-0 max-w-[calc(100%-40px)] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'rounded-br-sm bg-brand-green text-brand-surface' : 'rounded-bl-sm bg-brand-bgAlt'}`}>
              <span className="sr-only">{message.role === 'user' ? 'You' : 'Nara'}: </span>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{model.typingReply?.id === message.id ? <>
                <span aria-hidden="true">{model.typingReply.text}<span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 bg-brand-muted" /></span>
                <span className="sr-only">{message.text}</span>
              </> : <ReplyText text={message.text} links={message.reply?.links} onNavigate={modal ? () => model.setOpen(false) : undefined} />}</p>
              {message.restored && message.createdAt ? <p className={`mt-2 text-[11px] ${message.role === 'user' ? '' : 'text-brand-muted'}`}>Earlier · {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(message.createdAt)}</p> : null}
              {model.typingReply?.id === message.id ? <div className="mt-1"><TypingDots label="Nara is typing…" /></div> : null}
              {message.reply && model.typingReply?.id !== message.id ? <ReplyDetails reply={message.reply} onNavigate={modal ? () => model.setOpen(false) : undefined} /> : null}
            </div>
          </div>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">{quickActions.map(({ action, label }) => <button key={label} type="button" disabled={sendBlocked} onClick={() => model.send(action, label)}
          className="min-h-9 rounded-lg border border-brand-border px-2.5 text-xs text-brand-muted hover:bg-brand-bgAlt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green disabled:opacity-40">{label}</button>)}</div>
      </>}
      {model.busy ? <div className="mt-5 flex items-end gap-2">
        <NaraPortrait size={32} />
        <div className="rounded-2xl rounded-bl-sm bg-brand-bgAlt px-4 py-3">
          <TypingDots label={model.recoveryStatus ? 'Checking your previous reply…' : 'Nara is thinking…'} />
        </div>
      </div> : null}
      {model.recoveryKey && !model.busy ? <section aria-label="Recover previous reply" className="mt-5 border-t border-brand-border pt-4 text-sm leading-6">
        <p>{model.recoveryStatus ?? 'Recover your previous reply without calling AI again.'}</p>
        <Button size="sm" variant="secondary" onClick={model.checkRecovery} className="mt-3">Check reply</Button>
      </section> : null}
      {model.pending && !model.busy ? <section ref={confirmation} tabIndex={-1} aria-label="Confirm AI credit use" className="mt-5 rounded-2xl border border-brand-border bg-brand-bgAlt p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-green">
        <h3 className="text-sm font-semibold">This request uses 1 AI credit</h3>
        <p className="mt-2 text-xs leading-5 text-brand-muted">{model.allowance?.remaining ?? 0} credits remaining this week. AI replies depend on shared availability. Failed requests won’t spend a credit.</p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={model.confirm} disabled={!model.allowance?.remaining || model.cooldownSeconds > 0 || model.draft.length > 1000}>Continue</Button>
          <Button size="sm" variant="secondary" onClick={model.cancel}>Cancel</Button>
        </div>
        {!model.allowance?.remaining ? <p className="mt-3 text-xs leading-5 text-brand-muted">Credits reset {reset}. Free shortcuts are still available after cancelling.</p> : null}
      </section> : null}
      {model.error && !model.recoveryKey ? <div role="alert" className="mt-5 text-sm leading-6">
        <p>{model.error}</p>
        <button type="button" onClick={model.retry} disabled={sendBlocked || model.cooldownSeconds > 0} className="mt-2 min-h-10 rounded font-semibold text-brand-green underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green disabled:opacity-50">Retry request</button>
      </div> : null}
      <div ref={end} />
    </div>
    <footer className="shrink-0 border-t border-brand-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <p className="mb-3 text-xs text-brand-muted tabular-nums">{model.allowance ? `${model.allowance.tier === 'FREE' ? 'Free' : model.allowance.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} · ${model.allowance.remaining} / ${model.allowance.cap} AI credits · Resets ${reset}` : 'Checking AI credits…'}</p>
      {model.cooldownSeconds > 0 ? <div aria-label="AI request cooldown" className="mb-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">AI cooldown</span>
          <span role="timer" aria-live="off" aria-label="Time until your next AI request" className="font-semibold tabular-nums">{model.cooldownSeconds >= 3600 ? `${Math.floor(model.cooldownSeconds / 3600)}:${String(Math.floor(model.cooldownSeconds / 60) % 60).padStart(2, '0')}` : Math.floor(model.cooldownSeconds / 60)}:{String(model.cooldownSeconds % 60).padStart(2, '0')}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-brand-muted">Free system help is still available.</p>
      </div> : null}
      <AssistantComposer id={titleId} draft={model.draft} onChange={model.setDraft} onSend={() => model.send()}
        disabled={composerDisabled} sendBlocked={sendBlocked} cooldownBlocked={model.cooldownBlocksDraft} />
      <p className="mt-2 text-[11px] leading-4 text-brand-muted">AI replies depend on shared availability and can misinterpret requests. Your saved guidance and RND decisions still apply.</p>
    </footer>
  </div>;
}
