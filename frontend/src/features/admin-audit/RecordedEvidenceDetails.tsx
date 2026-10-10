'use client';
import { useState } from 'react';
import RecordedCaseFields from './RecordedCaseFields';

/** Long immutable snapshots render only when requested, keeping the canvas overview readable and small. */
export default function RecordedEvidenceDetails({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-xl border border-brand-border p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-bold">{label}</summary>
      {open && (
        <div className="mt-4">
          <RecordedCaseFields value={value} paper />
        </div>
      )}
    </details>
  );
}
