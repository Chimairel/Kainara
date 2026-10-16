'use client';

import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';

import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import api from '@/lib/axios';
import { safetyInputsFromProfile } from '@/lib/safety-intake';
import { CheckCircle } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';

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
  const { refreshSession } = useAuth();

  return (
    <>
      {activeSection === 'safety' && (
        <ProfileSettingsSection
          title="Conditions & food safety"
          description="Save these together so your meals can be checked against your latest information. You can update them at any time."
        >
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
            presentation="profile"
            onSaved={async (_entries, changed) => {
              setHealthSuccess(
                changed
                  ? 'Safety settings saved. Affected meals are being checked again and your nutrition report must be refreshed.'
                  : 'Your safety settings are already up to date.'
              );
              if (changed) {
                await refreshSession({ showLoader: false });
                router.push('/dashboard');
                return;
              }
              const response = await api.get('/user/profile');
              if (response.data?.success) setProfileData(response.data.data);
            }}
          />
        </ProfileSettingsSection>
      )}
    </>
  );
}
