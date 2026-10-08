import ExpertiseEditor, { type ExpertiseDraft } from './ExpertiseEditor';
import AccessControl from './AccessControl';
import { BadgeCheck } from 'lucide-react';
import Card from '@/components/ui/Card';
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
  if (!nutritionists.length) {
    return <Card className="p-10 text-center text-sm text-brand-muted">No saved RND profiles yet.</Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {nutritionists.map((nutritionist) => (
        <Card key={nutritionist.id} className="p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
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
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-brand-text">{nutritionist.user.name}</h3>
              <p className="truncate text-xs text-brand-muted">{nutritionist.user.email}</p>
              <p className="mt-1.5 break-all font-mono text-[9px] uppercase tracking-wider text-brand-muted">
                PRC {nutritionist.prcLicenseNumber}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-xl font-black text-brand-green">{nutritionist.totalVerified}</p>
              <p className="text-[9px] uppercase tracking-wider text-brand-muted">recorded verifications</p>
            </div>
          </div>
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
        </Card>
      ))}
    </div>
  );
}
