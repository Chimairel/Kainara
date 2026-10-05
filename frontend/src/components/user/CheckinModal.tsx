import Dropdown from '@/components/ui/Dropdown';
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/features/membership/MembershipProvider';

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileRevision?: number;
  hasPendingChanges?: boolean;
}

type CheckinFormData = { weightKg: string; activityLevel: string; goal: string };

export function buildDirtyCheckinUpdates(initial: CheckinFormData, current: CheckinFormData) {
  const updates: { weightKg?: number; activityLevel?: string; goal?: string } = {};
  if (current.weightKg !== initial.weightKg) {
    const parsedWeight = Number(current.weightKg);
    if (!Number.isFinite(parsedWeight)) throw new Error('Enter a valid weight.');
    updates.weightKg = parsedWeight;
  }
  if (current.activityLevel !== initial.activityLevel) updates.activityLevel = current.activityLevel;
  if (current.goal !== initial.goal) updates.goal = current.goal;
  return updates;
}

export default function CheckinModal({
  isOpen,
  onClose,
  profileRevision,
  hasPendingChanges = false,
}: CheckinModalProps) {
  const { refreshSession } = useAuth();
  const router = useRouter();
  const { data: membership } = useMembership();
  const free = Boolean(membership?.enabled && !membership.enhanced);
  const [step, setStep] = useState<'PROMPT' | 'FORM'>('PROMPT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    weightKg: '',
    activityLevel: '',
    goal: '',
  });
  const [initialFormData, setInitialFormData] = useState(formData);

  useEffect(() => {
    if (!isOpen) {
      setStep('PROMPT');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && step === 'FORM') {
      // Fetch profile to prefill
      api
        .get('/user/profile')
        .then((res) => {
          if (res.data?.success && res.data.data?.userProfile) {
            const profile = res.data.data.userProfile;
            const next = {
              weightKg: profile.weightKg ? String(profile.weightKg) : '',
              activityLevel: profile.activityLevel || 'SEDENTARY',
              goal: profile.goal || 'MAINTAIN',
            };
            setFormData(next);
            setInitialFormData(next);
          }
        })
        .catch((err) => {
          console.error('[CheckinModal] Failed to fetch profile:', err);
        });
    }
  }, [isOpen, step]);

  const handleSameSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(
        '/user/checkin/submit',
        hasPendingChanges
          ? { changed: true, updates: {}, profileRevision }
          : { changed: false, ...(profileRevision !== undefined ? { profileRevision } : {}) }
      );
      await refreshSession();
      window.dispatchEvent(new Event('kainara:checkin-updated'));
      onClose();
      router.push('/profile/nutrition-report');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit check-in.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const updates = buildDirtyCheckinUpdates(initialFormData, formData);
      if (Object.keys(updates).length === 0) {
        setError('Change at least one value, or choose “Still the same.”');
        return;
      }

      await api.post('/user/checkin/submit', {
        changed: true,
        updates,
        ...(profileRevision !== undefined ? { profileRevision } : {}),
      });
      await refreshSession();
      window.dispatchEvent(new Event('kainara:checkin-updated'));
      onClose();
      router.push('/profile/nutrition-report');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save your check-in.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'PROMPT') {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Weekly Check-in Due"
        description="Review your profile this week. Your response creates a new dated nutrition report."
      >
        <div className="flex flex-col gap-6 py-4 text-center">
          <p className="text-sm text-brand-muted">
            Are your measurements, activity, goals, preferences, conditions and allergies still correct?
          </p>

          {error && <p className="text-status-error-text text-xs bg-status-error-bg/10 p-2 rounded">{error}</p>}

          {hasPendingChanges && (
            <p className="text-sm text-brand-muted">
              Your saved details differ from your active planning report. Confirming creates a new report; applying
              changes may require Lifestyle or Health.
            </p>
          )}
          <Link href="/profile" onClick={onClose} className="text-sm font-semibold text-brand-green">
            Review all profile details
          </Link>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={handleSameSubmit} isLoading={isSubmitting}>
              {hasPendingChanges ? 'Confirm my saved updates' : 'Still the same'}
            </Button>
            <Button variant="secondary" onClick={() => setStep('FORM')} disabled={isSubmitting}>
              Update my profile
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Check-in Details"
      description="Save your current measurements and goals. Choose whether to apply them when you review the new nutrition report."
    >
      <div className="flex flex-col gap-5 py-2">
        {error && <p className="text-status-error-text text-xs bg-status-error-bg/10 p-2 rounded">{error}</p>}

        <div>
          <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">
            Current Weight (kg)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.weightKg}
            onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
            placeholder="e.g. 70.5"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">
            Activity Level
          </label>
          <Dropdown
            disabled={free}
            value={formData.activityLevel}
            onChange={(e) => setFormData({ ...formData, activityLevel: e })}
            className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text outline-none transition-all placeholder:text-brand-muted focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          >
            <option value="SEDENTARY">Sedentary (Little or no exercise)</option>
            <option value="LIGHTLY_ACTIVE">Lightly Active (Exercise 1-3 times/week)</option>
            <option value="ACTIVE">Active (Exercise 3-5 times/week)</option>
            <option value="VERY_ACTIVE">Very Active (Daily exercise)</option>
          </Dropdown>
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Primary Goal</label>
          <Dropdown
            disabled={free}
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e })}
            className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text outline-none transition-all placeholder:text-brand-muted focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          >
            <option value="LOSE_WEIGHT">Lose Weight</option>
            <option value="MAINTAIN">Maintain Weight</option>
            <option value="GAIN_WEIGHT">Gain Weight</option>
            <option value="BUILD_MUSCLE">Build Muscle</option>
          </Dropdown>
        </div>

        {free && (
          <p className="text-xs text-brand-muted">
            Weight updates are free. Activity and goal changes require Lifestyle or Health.
          </p>
        )}
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setStep('PROMPT')} disabled={isSubmitting}>
            Back
          </Button>
          <Button variant="primary" onClick={handleUpdateSubmit} isLoading={isSubmitting}>
            Save and review report
          </Button>
        </div>
      </div>
    </Modal>
  );
}
