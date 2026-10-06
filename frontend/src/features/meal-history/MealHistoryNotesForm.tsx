'use client';

import { Check, FileText, Loader2, Save } from 'lucide-react';

import type { useMealHistoryCardModel } from './useMealHistoryCardModel';
type Model = Extract<ReturnType<typeof useMealHistoryCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'log' | 'noteInput' | 'setNoteInput' | 'saveError' | 'saveSuccess' | 'handleSaveNotes' | 'isSaving'
  >;
};
export default function MealHistoryNotesForm({ model }: SectionProps) {
  const { log, noteInput, setNoteInput, saveError, saveSuccess, handleSaveNotes, isSaving } = model;

  return (
    <>
      <div className="rounded-xl border border-white/20 bg-black/25 p-3.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor={`meal-note-${log.id}`}
            className="flex items-center gap-1.5 font-display text-xs font-bold text-white"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-300" />
            Personal Meal Notes
          </label>
          <span className="font-mono text-[10px] text-white/60">{noteInput.length} / 1000</span>
        </div>

        <textarea
          id={`meal-note-${log.id}`}
          rows={2}
          maxLength={1000}
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="Add personal note (e.g. portion adjustment, how you felt, substitutions made)..."
          className="w-full rounded-xl border border-white/20 bg-white/10 p-2.5 text-xs text-white placeholder:text-white/50 outline-none transition focus:border-white focus:bg-white/15 resize-none"
        />

        {saveError && <p className="mt-1 text-[11px] font-semibold text-rose-300">{saveError}</p>}

        <div className="mt-2.5 flex items-center justify-between">
          {saveSuccess ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 animate-fadeIn">
              <Check className="h-3.5 w-3.5 stroke-[3]" /> Note saved
            </span>
          ) : (
            <span className="text-[10px] text-white/60">Notes are private to your personal timeline.</span>
          )}

          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={isSaving || noteInput === (log.notes || '')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 hover:bg-white/30 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Save Note</span>
          </button>
        </div>
      </div>
    </>
  );
}
