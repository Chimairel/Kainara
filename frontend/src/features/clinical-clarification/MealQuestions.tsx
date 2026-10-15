'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { readSessionResource, refreshSessionResource, invalidateSessionResource } from '@/lib/session-resource-cache';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { MessageSquare } from '@/components/ui/icons';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import MemberClarifications from './MemberClarifications';
import type { ClarificationWorkspace } from './types';

const resource = 'member-meal-questions';

export default function MealQuestions({ ownerId }: { ownerId: string | undefined }) {
  const questionId = useSearchParams().get('questions');
  const owner = useRef(ownerId);
  owner.current = ownerId;
  const [saved, setSaved] = useState<{ ownerId: string; data: ClarificationWorkspace } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const workspace = saved && saved.ownerId === ownerId ? saved.data : undefined;
  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const data = await refreshSessionResource<ClarificationWorkspace>(ownerId, resource, async () => {
      const response = await api.get('/user/meal-clarifications');
      if (!response.data?.success || !Array.isArray(response.data.data?.forms)) throw new Error('Invalid question response.');
      return response.data.data;
    });
    if (owner.current === ownerId) { setSaved({ ownerId, data }); setError(null); }
  }, [ownerId]);

  useEffect(() => {
    setOpen(Boolean(questionId));
    setError(null);
    if (!ownerId) return;
    const cached = readSessionResource<ClarificationWorkspace>(ownerId, resource, 60_000);
    if (cached && (!questionId || cached.forms.some(form => form.id === questionId))) {
      setSaved({ ownerId, data: cached });
      return;
    }
    void refresh().catch(cause => {
      if (owner.current === ownerId) setError(getApiErrorMessage(cause, 'Meal questions could not be loaded.'));
    });
  }, [ownerId, questionId, refresh]);

  const reload = async () => {
    invalidateSessionResource(ownerId, resource);
    await refresh();
  };
  if (!ownerId || (!error && (!workspace?.enabled || !workspace.forms.length))) return null;
  const pending = workspace?.forms.filter(form => form.status === 'AWAITING_MEMBER' || form.status === 'ANSWERED').length ?? 0;
  return <section aria-label="Meal questions" className="mb-5">
    {error ? <FeedbackNotice variant="inline">
      {error} <button className="underline" onClick={() => void reload().catch(() => {})}>Retry</button>
    </FeedbackNotice> : <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
      <MessageSquare aria-hidden="true" className="mr-2 h-4 w-4" />
      RND meal questions{pending ? ` (${pending})` : ''}
    </Button>}
    <Modal isOpen={open} onClose={() => setOpen(false)} size="lg" title="Questions about your meals"
      description="Your RND will review your answers before deciding on the meal. Answering does not change your profile.">
      <MemberClarifications workspace={workspace} onUpdated={reload} />
    </Modal>
  </section>;
}
