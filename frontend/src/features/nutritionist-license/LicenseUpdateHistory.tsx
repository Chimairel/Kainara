'use client';
import Button from '@/components/ui/Button';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import type { LicenseUpdate } from './types';
import { licenseDate } from './types';

export default function LicenseUpdateHistory({
  rows,
  admin = false,
  busyId,
  onDownload,
  onReview,
}: {
  rows: LicenseUpdate[];
  admin?: boolean;
  busyId: string | null;
  onDownload: (record: LicenseUpdate) => void;
  onReview?: (record: LicenseUpdate) => void;
}) {
  return (
    <WorkspaceTable
      label={admin ? 'License updates for administrator review' : 'Your license update history'}
      rows={rows}
      rowKey={(row) => row.id}
      emptyMessage={admin ? 'No license updates match this view.' : 'You have not submitted a license update.'}
      columns={[
        ...(admin
          ? [
              {
                key: 'rnd',
                header: 'RND',
                headerClassName: 'min-w-[180px]',
                cell: (row: LicenseUpdate) => (
                  <div>
                    <p className="font-semibold">{row.nutritionistProfile?.user.name}</p>
                    <p className="mt-1 break-all text-xs text-brand-muted">{row.nutritionistProfile?.user.email}</p>
                  </div>
                ),
              },
            ]
          : []),
        {
          key: 'request',
          header: 'Update',
          headerClassName: 'min-w-[180px]',
          cell: (row) => (
            <div>
              <p className="font-semibold">{row.purpose === 'RENEWAL' ? 'License renewal' : 'Record correction'}</p>
              <p className="mt-1 text-xs text-brand-muted">Submitted {licenseDate(row.createdAt)}</p>
              <p className="mt-2 text-xs leading-relaxed">{row.submissionReason}</p>
            </div>
          ),
        },
        {
          key: 'details',
          header: 'Recorded → Submitted',
          headerClassName: 'min-w-[200px]',
          cell: (row) => (
            <div className="space-y-2 text-xs">
              <p>
                {row.previousLicenseNumber} · {licenseDate(row.previousLicenseExpiry)}
              </p>
              <p className="font-semibold">
                {row.proposedLicenseNumber} · {licenseDate(row.proposedLicenseExpiry)}
              </p>
            </div>
          ),
        },
        {
          key: 'decision',
          header: 'Status / decision',
          headerClassName: 'min-w-[180px]',
          cell: (row) => (
            <div>
              <p className="font-semibold">
                {row.status === 'PENDING'
                  ? 'Awaiting admin review'
                  : row.status === 'APPROVED'
                    ? 'Approved'
                    : 'Rejected'}
              </p>
              {row.decisionReason && <p className="mt-2 text-xs leading-relaxed">{row.decisionReason}</p>}
              {row.reviewerName && (
                <p className="mt-2 text-xs text-brand-muted">
                  {row.reviewerName} · {licenseDate(row.reviewedAt)}
                </p>
              )}
            </div>
          ),
        },
        {
          key: 'actions',
          header: 'Evidence / actions',
          headerClassName: 'min-w-[160px]',
          cell: (row) => (
            <div className="flex flex-col items-start gap-2">
              <Button variant="secondary" size="sm" disabled={!!busyId} onClick={() => onDownload(row)}>
                Download license
              </Button>
              {onReview && row.status === 'PENDING' && (
                <Button size="sm" onClick={() => onReview(row)}>
                  Review update
                </Button>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
