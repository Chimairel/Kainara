import type { useFlagDraft } from './useFlagDraft';
export default function FlagDraftNotice({ draft, compact = false }: { draft: ReturnType<typeof useFlagDraft>; compact?: boolean }) {
  return <>{draft.status?.blocked && <p role="status" className="text-sm text-brand-muted">{compact ? `Draft held by ${draft.status.ownerName ?? 'another RND'}` : `Flag in progress by ${draft.status.ownerName ?? 'another RND'}. You can still read these details and the audit.`}</p>}
    {draft.writing && !compact && <p className="text-xs text-brand-muted">Private draft · saved while you type. The lock expires after 30 minutes without edits.</p>}
    {draft.error && <p role="alert" className="text-sm text-status-error-text">{draft.error}{draft.writing && <button type="button" className="ml-2 underline underline-offset-4" onClick={() => void draft.save()}>Retry save</button>}</p>}</>;
}
