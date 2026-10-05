'use client';

import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Download, Loader2 } from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';
import type { ReportVersion } from './ReportHistory';

export default function ReportVersionPicker({
  versions,
  selectedVersion,
  currentVersion,
  onSelect,
  onDownload,
  onSetAsCurrent,
  downloading = false,
}: {
  versions: ReportVersion[];
  selectedVersion: number;
  currentVersion: number;
  onSelect: (version: ReportVersion) => void;
  onDownload?: (version: ReportVersion) => void;
  onSetAsCurrent?: (version: ReportVersion) => void;
  downloading?: boolean;
}) {
  const selected = versions.find((version) => version.version === selectedVersion);
  return (
    <div aria-label="Report versions" className="flex min-w-0 flex-wrap items-center gap-2">
      <Select
        aria-label="Report version"
        className="min-w-0 flex-1 basis-48 sm:max-w-sm"
        value={String(selectedVersion)}
        options={versions.map((version) => ({
          value: String(version.version),
          label: `Version ${version.version} · ${formatManilaDate(version.generatedAt, { month: 'short', day: 'numeric', year: 'numeric' })}${version.version === currentVersion ? ' · Current' : ''}`,
        }))}
        onChange={(value) => {
          const version = versions.find((entry) => String(entry.version) === value);
          if (version) onSelect(version);
        }}
      />
      {onDownload && selected && (
        <Button
          variant="secondary"
          className="h-11 w-11 shrink-0 !p-0"
          aria-label="Download PDF"
          title="Download PDF"
          disabled={downloading}
          onClick={() => onDownload(selected)}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      )}
      {onSetAsCurrent && selected && selectedVersion !== currentVersion && (
        <Button variant="secondary" size="sm" onClick={() => onSetAsCurrent(selected)}>
          Set as current
        </Button>
      )}
    </div>
  );
}
