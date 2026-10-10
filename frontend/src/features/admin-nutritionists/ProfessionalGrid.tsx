import ExpertiseEditor, { type ExpertiseDraft } from './ExpertiseEditor';
import AccessControl from './AccessControl';
import { BadgeCheck } from 'lucide-react';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import Avatar from '@/components/ui/Avatar';
import { professionalAccessLabel, type NutritionistRow } from './model';

export function ProfessionalGrid({
  nutritionists,
  workingId,
  onChangeAccess,
  onVerifyExpertise,
}: {
  nutritionists: NutritionistRow[];
  onVerifyExpertise?: (nutritionist: NutritionistRow, draft: ExpertiseDraft) => Promise<void>;
  workingId?: string | null;
  onChangeAccess?: (nutritionist: NutritionistRow, suspended: boolean, reason: string) => Promise<void>;
}) {
  return (
    <WorkspaceTable
      label="RND professional records"
      rows={nutritionists}
      rowKey={(professional) => professional.id}
      emptyMessage="No saved RND profiles yet."
      columns={[
        {
          key: 'professional',
          header: 'RND',
          headerClassName: 'min-w-[220px]',
          cell: (nutritionist) => (
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar
                  name={nutritionist.user.name}
                  seed={nutritionist.user.image}
                  size="md"
                  className="border border-brand-green/30"
                />
                {professionalAccessLabel(nutritionist) === 'Access active' && (
                  <span
                    aria-label="Verified PRC Dietitian"
                    className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-brand-border bg-brand-green text-[#07100d]"
                  >
                    <BadgeCheck className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="break-words font-bold">{nutritionist.user.name}</h3>
                <p className="mt-1 break-all text-[11px] text-brand-muted">{nutritionist.user.email}</p>
              </div>
            </div>
          ),
        },
        {
          key: 'license',
          header: 'PRC license',
          headerClassName: 'min-w-[120px]',
          cell: (nutritionist) => <span className="break-all font-mono">{nutritionist.prcLicenseNumber}</span>,
        },
        {
          key: 'verified',
          header: 'Recorded verifications',
          cell: (nutritionist) => <strong className="font-mono text-brand-green">{nutritionist.totalVerified}</strong>,
        },
        {
          key: 'access',
          header: 'Access',
          headerClassName: 'min-w-[160px]',
          cell: (nutritionist) => professionalAccessLabel(nutritionist),
        },
        {
          key: 'actions',
          header: 'Credentials / actions',
          headerClassName: 'min-w-[240px]',
          cell: (nutritionist) => (
            <>
              {onVerifyExpertise && (
                <ExpertiseEditor
                  professional={nutritionist}
                  busy={workingId === nutritionist.id}
                  onSave={(draft) => onVerifyExpertise(nutritionist, draft)}
                />
              )}
              {onChangeAccess && (
                <AccessControl
                  professional={nutritionist}
                  busy={workingId === nutritionist.id}
                  onChange={(suspended, reason) => onChangeAccess(nutritionist, suspended, reason)}
                />
              )}
            </>
          ),
        },
      ]}
    />
  );
}
