'use client';

import Avatar from '@/components/ui/Avatar';

import { toast } from '@/components/ui/Sonner';

import api from '@/lib/axios';

import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';
type Model = Extract<ReturnType<typeof useCaseReviewWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'detailData'>; paper?: boolean };
export default function CaseProfileSection({ model, paper = false }: SectionProps) {
  const { detailData } = model;
  if (!detailData) return null;
  return (
    <>
      <div
        className={
          paper
            ? 'space-y-5'
            : 'space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card'
        }
      >
        <div className="flex items-center gap-3.5 border-b border-brand-border pb-3">
          <Avatar name={detailData.user.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Member Health Profile</h2>
            <h3 className="truncate text-base font-extrabold text-brand-text mt-0.5">{detailData.user.name}</h3>
            <p className="text-xs text-brand-muted">
              {detailData.user.age} yrs • {detailData.user.sex}
            </p>
          </div>
        </div>

        {/* Health Conditions */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-brand-muted">Conditions</h4>
          <div className="flex flex-wrap gap-1.5">
            {detailData.user.conditions.length === 0 ? (
              <span className="text-xs text-brand-muted italic">None declared</span>
            ) : (
              detailData.user.conditions.map((hc, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 border text-[10px] rounded-lg font-bold ${paper ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-950/30 border-red-800/30 text-red-400'}`}
                >
                  {hc}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Allergies */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-brand-muted">Allergies</h4>
          <div className="flex flex-wrap gap-1.5">
            {detailData.user.allergies.length === 0 ? (
              <span className="text-xs text-brand-muted italic">None declared</span>
            ) : (
              detailData.user.allergies.map((alg, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 border text-[10px] rounded-lg font-bold ${paper ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-950/30 border-red-800/30 text-red-400'}`}
                >
                  {alg}
                </span>
              ))
            )}
          </div>
        </div>

        {detailData.user.safetyEntries && detailData.user.safetyEntries.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-brand-muted">Complete structured restrictions</h4>
            <div className="space-y-1.5">
              {detailData.user.safetyEntries.map((entry, index) => (
                <div
                  key={`${entry.domain}-${entry.label}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-brand-border/60 bg-brand-bg/50 px-2.5 py-2 text-[10px]"
                >
                  <span className="font-bold text-brand-text">{entry.label}</span>
                  <span className="text-right font-mono uppercase text-brand-muted">
                    {entry.domain.replaceAll('_', ' ')} · {entry.supportState.replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detailData.clinicalEvidence && detailData.clinicalEvidence.requirements.length > 0 && (
          <div className="space-y-2 border-t border-brand-border pt-3 text-xs">
            <h4 className="font-bold text-brand-text">Health details reviewed for the profile</h4>
            {detailData.clinicalEvidence.healthDetails?.map((item) => (
              <div key={item.area} className="rounded-lg border border-brand-border p-2">
                <p className="font-bold">{item.area.replaceAll('_', ' ')} · member-provided</p>
                {['conditionDetails', 'medications', 'dietaryAdvice', 'recentSymptoms', 'measurements'].map((field) =>
                  typeof item.responses[field] === 'string' && item.responses[field] ? (
                    <p key={field} className="mt-1 whitespace-pre-wrap">
                      <strong>{field.replace(/([A-Z])/g, ' $1')}: </strong>
                      {String(item.responses[field])}
                    </p>
                  ) : null
                )}
              </div>
            ))}
            {detailData.clinicalEvidence.requirements.map((item) => (
              <p key={item.area} className={item.state === 'READY' ? 'text-brand-green' : 'text-amber-500'}>
                {item.area.replaceAll('_', ' ')}: {item.message}
              </p>
            ))}
            {detailData.clinicalEvidence.documents.map((item) => (
              <div key={item.id} className="rounded-lg border border-brand-border p-2">
                <p>
                  {item.area.replaceAll('_', ' ')} · {item.documentType.replaceAll('_', ' ')}
                  {item.validUntil ? ` · valid until ${new Date(item.validUntil).toLocaleDateString()}` : ''}
                </p>
                {item.facts.map((fact, index) => (
                  <p key={`${fact.code}-${index}`} className="text-brand-muted">
                    {fact.code.replaceAll('_', ' ')}: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''}
                  </p>
                ))}
                {detailData.claimStatus.claimedByMe && (
                  <button
                    type="button"
                    className="mt-1 font-semibold text-brand-green underline"
                    onClick={async () => {
                      try {
                        const response = await api.get(
                          `/nutritionist/queue/${detailData.mealPlan.id}/clinical-evidence/${item.id}/file`,
                          { responseType: 'blob' }
                        );
                        const url = URL.createObjectURL(response.data);
                        const anchor = document.createElement('a');
                        anchor.href = url;
                        anchor.download = 'clinical-document';
                        anchor.click();
                        setTimeout(() => URL.revokeObjectURL(url), 30_000);
                      } catch {
                        toast.error(
                          'The clinical document could not be opened. Refresh your review claim and try again.'
                        );
                      }
                    }}
                  >
                    Download original record
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* General Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-brand-border">
          <div>
            <span className="block text-[10px] text-brand-muted">Target Goal</span>
            <strong className="text-brand-text text-xs uppercase">{detailData.user.goal}</strong>
          </div>
          <div>
            <span className="block text-[10px] text-brand-muted">Daily Target</span>
            <strong className="text-brand-text text-xs">{detailData.user.dailyCalorieTarget} kcal</strong>
          </div>
          <div>
            <span className="block text-[10px] text-brand-muted">Diet Preference</span>
            <strong className="text-brand-text text-xs uppercase">{detailData.user.dietaryPreference}</strong>
          </div>
          <div>
            <span className="block text-[10px] text-brand-muted">Rice Preference</span>
            <strong className="text-brand-text text-xs uppercase">{detailData.user.ricePreference}</strong>
          </div>
        </div>
      </div>
    </>
  );
}
