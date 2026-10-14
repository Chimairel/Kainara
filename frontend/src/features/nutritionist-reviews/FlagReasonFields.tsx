'use client';
import { useId, useState } from 'react';
import NativeSelect from '@/components/ui/NativeSelect';

export type FlagReason = { category: string; affectedFields: string; explanation: string; reference: string; proposedCorrection: string };
export const emptyFlagReason: FlagReason = { category: 'NUTRITION', affectedFields: '', explanation: '', reference: '', proposedCorrection: '' };
export const validFlagReason = (draft: FlagReason) => draft.affectedFields.trim().length > 0 && draft.explanation.trim().length >= 20 && draft.reference.trim().length >= 10 && draft.proposedCorrection.trim().length >= 10;
export const flagReasonPayload = (draft: FlagReason) => ({ ...draft, affectedFields: draft.affectedFields.split(',').map(value => value.trim()).filter(Boolean) });
export const useFlagReasonDraft = () => useState<FlagReason>({ ...emptyFlagReason });

/** Same structured concern fields for recipe and approval flags. */
export default function FlagReasonFields({ value, onChange, busy = false }: { value: FlagReason; onChange: (value: FlagReason) => void; busy?: boolean }) {
  const id = useId();
  const field = 'min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface p-3 text-base text-brand-text';
  return <fieldset disabled={busy} className="space-y-6">
    <div className="space-y-2 text-sm font-semibold"><label htmlFor={`${id}-category`}>Concern category</label>
      <NativeSelect id={`${id}-category`} value={value.category} onChange={event => onChange({ ...value, category: event.target.value })}>
        {['INGREDIENT', 'NUTRITION', 'ALLERGEN', 'PREPARATION', 'EVIDENCE', 'OTHER'].map(code => <option key={code} value={code}>{code.charAt(0) + code.slice(1).toLowerCase()}</option>)}
      </NativeSelect>
    </div>
    <div className="space-y-2 text-sm font-semibold"><label htmlFor={`${id}-affected`}>Affected ingredients or nutrition fields</label>
      <input id={`${id}-affected`} className={field} required maxLength={2000} value={value.affectedFields} onChange={event => onChange({ ...value, affectedFields: event.target.value })} />
      <span className="block text-xs font-normal text-brand-muted">Separate multiple fields with commas.</span>
    </div>
    {([
      ['explanation', 'Explanation', 20, 3000], ['reference', 'Supporting evidence or reference', 10, 2000],
      ['proposedCorrection', 'Proposed correction', 10, 2000],
    ] as const).map(([key, label, minimum, maximum]) => <div key={key} className="space-y-2">
      <label htmlFor={`${id}-${key}`} className="block text-sm font-semibold">{label}</label>
      <textarea id={`${id}-${key}`} className={field} rows={key === 'explanation' ? 5 : 3} required minLength={minimum} maxLength={maximum}
        value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} aria-describedby={`${id}-${key}-help`} />
      <p id={`${id}-${key}-help`} className="text-xs text-brand-muted">At least {minimum} characters.</p>
    </div>)}
  </fieldset>;
}
