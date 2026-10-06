'use client';

import type { useMealHistoryCardModel } from './useMealHistoryCardModel';
type Model = Extract<ReturnType<typeof useMealHistoryCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'log'
    | 'isVoided'
    | 'onVoidOutsideLog'
    | 'voidReason'
    | 'setVoidReason'
    | 'isChanging'
    | 'setIsChanging'
    | 'setSaveError'
  >;
};
export default function VoidOutsideMealForm({ model }: SectionProps) {
  const { log, isVoided, onVoidOutsideLog, voidReason, setVoidReason, isChanging, setIsChanging, setSaveError } = model;

  return (
    <>
      {log.source === 'USER_LOGGED' && !isVoided && onVoidOutsideLog && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-3 text-xs text-white">
          <p className="font-bold text-rose-300">Remove this entry from active totals</p>
          <p className="mb-2 text-white/80">The original record and corrections remain in your history.</p>
          <input
            className="w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
            aria-label="Reason for voiding"
            placeholder="Reason for voiding this entry"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
          <button
            type="button"
            disabled={isChanging || voidReason.trim().length < 3}
            className="mt-2 rounded border border-rose-400 bg-rose-500/20 px-3 py-1 text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
            onClick={async () => {
              setIsChanging(true);
              setSaveError(null);
              try {
                await onVoidOutsideLog(log.id, voidReason.trim());
              } catch {
                setSaveError('Could not void this entry.');
              } finally {
                setIsChanging(false);
              }
            }}
          >
            Void outside meal
          </button>
        </div>
      )}
    </>
  );
}
