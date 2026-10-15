import { useState } from 'react';
import { emptyFlagReason, type FlagReason } from '@/features/nutritionist-reviews/FlagReasonFields';
import type { FlagDraftTarget } from '@/features/nutritionist-reviews/useFlagDraft';

/** Component fixtures isolate existing canvas behavior; lease transport has dedicated tests. */
export const mockFlagDraftId = '00000000-0000-4000-8000-000000000015';
export function useFlagDraftMock(target: FlagDraftTarget | null) {
  const [writing, setWriting] = useState(false);
  const [notes, setNotes] = useState<FlagReason>({ ...emptyFlagReason });
  const completed = () => { setWriting(false); setNotes({ ...emptyFlagReason }); };
  return { writing, notes, setNotes, busy: false, error: '', ready: Boolean(target),
    status: { blocked: false, canFlag: true, ownerName: null, expiresAt: null, draft: writing ? { id: mockFlagDraftId, notes, expectedVersion: '' } : null },
    draftId: writing ? mockFlagDraftId : undefined,
    begin: async () => { setWriting(true); return true; }, cancel: async () => { completed(); return true; }, save: async () => true, completed };
}
