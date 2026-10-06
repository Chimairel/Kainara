'use client';

import Card from '@/components/ui/Card';

import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import api from '@/lib/axios';
import { safetyInputsFromProfile } from '@/lib/safety-intake';
import { CheckCircle, Heart } from 'lucide-react';

import type { useProgressWorkspaceModel } from './useProgressWorkspaceModel';
type Model = Extract<ReturnType<typeof useProgressWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'activeSection' | 'healthSuccess' | 'profileData' | 'setHealthSuccess' | 'router' | 'setProfileData'
  >;
};
export default function ProgressSafetySection({ model }: SectionProps) {
  const { activeSection, healthSuccess, profileData, setHealthSuccess, router, setProfileData } = model;

  return (
    <>
      {activeSection === 'safety' && (
        <Card className="p-6 border-brand-border/70 bg-brand-surface shadow-card text-left mb-8">
          <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-2 font-display flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-brand-green" />
            <span>Conditions, allergies & foods to avoid</span>
          </h3>
          <p className="text-xs text-brand-muted mb-6 leading-relaxed">
            Save these together so your meals can be checked against your latest information. You can update them at any
            time.
          </p>

          {healthSuccess && (
            <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
              <span>{healthSuccess}</span>
            </div>
          )}

          <StructuredSafetyIntake
            initialEntries={safetyInputsFromProfile(profileData)}
            editableDomains={['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']}
            submitLabel="Save safety changes"
            onSaved={async (_entries, changed) => {
              setHealthSuccess(
                changed
                  ? 'Safety settings saved. Affected meals are being checked again and your nutrition report must be refreshed.'
                  : 'Your safety settings are already up to date.'
              );
              if (changed) {
                router.push('/profile/nutrition-report');
                return;
              }
              const response = await api.get('/user/profile');
              if (response.data?.success) setProfileData(response.data.data);
            }}
          />
        </Card>
      )}
    </>
  );
}
