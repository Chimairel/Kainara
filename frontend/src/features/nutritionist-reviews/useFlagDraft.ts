'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { emptyFlagReason, type FlagReason } from './FlagReasonFields';

export type FlagDraftTarget = { kind: 'MEAL'|'CASE'|'PROFILE'|'CONDITION'; targetId: string; mealId?: string };
type Status = { blocked: boolean; ownerName: string | null; canFlag: boolean; expiresAt: string | null;
  draft: { id: string; notes: FlagReason; expectedVersion: string } | null };
/** Private draft recovery and an expiring exclusive lease; no live text sharing. */
export function useFlagDraft(target: FlagDraftTarget | null, expectedVersion: string | undefined, admin = false) {
  const scope = JSON.stringify(target);
  const base = `${admin ? '/admin' : '/nutritionist'}/flag-drafts`;
  const [status, setStatus] = useState<Status | null>(null);
  const [notes, setNotes] = useState<FlagReason>({ ...emptyFlagReason });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef<Status | null>(null), generation = useRef(0), pending = useRef(false);
  const latestNotes = useRef(notes); latestNotes.current = notes;
  const saved = useRef('');
  const saving = useRef<Promise<boolean> | null>(null);
  const revision = useRef(0);
  const accept = useCallback((next: Status) => {
    if (next.draft?.id !== active.current?.draft?.id) {
      const restored = next.draft?.notes ?? { ...emptyFlagReason };
      setNotes(restored); latestNotes.current = restored; saved.current = JSON.stringify(restored);
    }
    active.current = next; setStatus(next);
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    active.current = null; setStatus(null); setError(''); saved.current = '';
    setNotes({ ...emptyFlagReason }); pending.current = false; setBusy(false);
    if (!target || !expectedVersion) return;
    const refresh = async () => {
      const requestedRevision = revision.current;
      try {
        const response = await api.post(`${base}/status`, { target });
        if (current === generation.current && requestedRevision === revision.current && !pending.current) {
          accept(response.data.data);
          if (!response.data.data.draft || saved.current === JSON.stringify(latestNotes.current)) setError('');
        }
      } catch (failure) {
        if (current === generation.current && requestedRevision === revision.current && !pending.current)
          setError(getApiErrorMessage(failure, 'Could not check flag availability. Retry before writing.'));
      }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !pending.current) void refresh(); }, 15000);
    return () => { generation.current = current + 1; window.clearInterval(timer); };
    // The stable serialized target owns this lease, not the caller's object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, expectedVersion, base, accept]);
  const command = async (action: 'begin'|'cancel') => {
    if (saving.current) await saving.current;
    if (!target || !expectedVersion || pending.current) return false;
    pending.current = true; ++revision.current; setBusy(true); setError(''); const current = generation.current;
    try {
      const response = await api.post(`${base}/${action}`, { target, expectedVersion, ...(action === 'cancel' ? { draftId: active.current?.draft?.id } : {}) });
      if (current !== generation.current) return false;
      accept(response.data.data); return !response.data.data.blocked;
    } catch (failure) { if (current === generation.current) setError(getApiErrorMessage(failure, 'Could not update this flag draft. Please retry.')); return false; }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  };
  const save = (): Promise<boolean> => {
    if (saving.current) return saving.current.then(() => save());
    const run = async () => {
    const draft = active.current?.draft;
    if (!target || !draft || pending.current) return false;
    const snapshot = latestNotes.current, serialized = JSON.stringify(snapshot);
    if (saved.current === serialized) return true;
    pending.current = true; ++revision.current; const current = generation.current;
    try {
      const response = await api.post(`${base}/save`, { target, draftId: draft.id, notes: snapshot });
      if (current !== generation.current) return false;
      saved.current = serialized; accept(response.data.data); setError(''); return true;
    } catch (failure) { if (current === generation.current) setError(getApiErrorMessage(failure, 'Draft not saved. Keep this page open and retry.')); return false; }
    finally { saving.current = null; if (current === generation.current) pending.current = false; }
    };
    saving.current = run();
    // An unchanged draft can resolve synchronously before the finally above.
    const operation = saving.current;
    return operation.then(value => { if (saving.current === operation) saving.current = null; return value; });
  };
  useEffect(() => () => {
    const draft = active.current?.draft;
    if (target && draft && saved.current !== JSON.stringify(latestNotes.current))
      void api.post(`${base}/save`, { target, draftId: draft.id, notes: latestNotes.current }).catch(() => undefined);
    // Preserve the final short typing interval when a containing audit closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, base]);
  useEffect(() => {
    if (!status?.draft || saved.current === JSON.stringify(notes)) return;
    // Short pauses save the private draft; polling alone never extends the lock.
    const timer = window.setTimeout(() => { void save(); }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, status?.draft?.id]);
  const completed = () => { active.current = null; setStatus(null); setNotes({ ...emptyFlagReason }); saved.current = ''; };
  return { notes, setNotes, busy, error, status, writing: Boolean(status?.draft), draftId: status?.draft?.id,
    ready: Boolean(status && !status.blocked && status.canFlag && !error), begin: () => command('begin'), cancel: () => command('cancel'), save, completed };
}
