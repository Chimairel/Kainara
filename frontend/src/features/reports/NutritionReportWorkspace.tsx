'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import ReportHistory from '@/features/reports/ReportHistory';
import NutritionGuidanceDocument from '@/features/reports/NutritionGuidanceDocument';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pendingMembershipSelection } from '@/features/membership/checkout';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { NutritionReport } from '@/types';
import { AlertTriangle } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasSameRestrictionContext, normalizeRestrictionContext } from '@/lib/restriction-context';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';
import { toast } from '@/components/ui/Sonner';
import type { PlanningReadiness } from '@/types/planning-readiness';

export default function NutritionReportPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const userId = user?.userId;
  const { isDownloadingPdf, startPdfDownload } = usePdfDownload(userId);
  const [history, setHistory] = useState<
    Array<{ id: string; version: number; generatedAt: string; content: NutritionReport }>
  >([]);
  const [report, setReport] = useState<NutritionReport | null>(null);
  const [profileData, setProfileData] = useState<{
    name: string;
    goal: string;
    dailyCalorieTarget: number;
    conditions: string[];
    allergies: string[];
  } | null>(null);
  const [requiredTier, setRequiredTier] = useState<'Lifestyle' | 'Health' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const acknowledgmentInFlight = useRef(false);
  const acknowledgmentReadiness = useRef<PlanningReadiness | undefined>(undefined);
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  const extractRestrictionKeys = (values: unknown, objectKey: 'condition' | 'allergen') => {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object' && objectKey in value) {
          const candidate = (value as Record<string, unknown>)[objectKey];
          return typeof candidate === 'string' ? candidate : '';
        }
        return '';
      })
      .filter((value) => value && value !== 'NONE');
  };

  const extractStructuredRestrictions = (values: unknown, domainGroup: 'condition' | 'food') => {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')
      .filter((entry) =>
        domainGroup === 'condition'
          ? entry.domain === 'CONDITION'
          : entry.domain === 'ALLERGY' || entry.domain === 'INTOLERANCE' || entry.domain === 'AVOIDED_INGREDIENT'
      )
      .map((entry) =>
        typeof entry.canonicalCode === 'string' && entry.canonicalCode
          ? entry.canonicalCode
          : typeof entry.displayName === 'string'
            ? entry.displayName
            : ''
      )
      .filter((value) => value && value !== 'NONE');
  };

  const applyProfile = useCallback((p: Record<string, unknown>) => {
    const structuredConditions = extractStructuredRestrictions(p.safetyEntries, 'condition');
    const structuredFoodRestrictions = extractStructuredRestrictions(p.safetyEntries, 'food');
    setProfileData({
      name: typeof p.name === 'string' ? p.name : 'Member',
      goal: (p.userProfile as { goal?: string } | undefined)?.goal || 'MAINTAIN',
      dailyCalorieTarget: (p.userProfile as { dailyCalorieTarget?: number } | undefined)?.dailyCalorieTarget || 0,
      conditions: normalizeRestrictionContext(
        structuredConditions ?? extractRestrictionKeys(p.healthConditions, 'condition')
      ),
      allergies: normalizeRestrictionContext(
        structuredFoodRestrictions ?? extractRestrictionKeys(p.allergies, 'allergen')
      ),
    });
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Parallelize fetching profile, history, and existing report
        const [profileRes, historyRes, getRes] = await Promise.all([
          api.get('/user/profile'),
          api.get('/user/nutrition-report/history').catch(() => ({ data: { data: [] } })),
          api.get('/user/nutrition-report'),
        ]);

        if (profileRes.data?.success) applyProfile(profileRes.data.data);

        setHistory(historyRes.data?.data || []);

        // Try getting existing report first
        const activeRevision = profileRes.data?.data?.userProfile?.revision;
        const existingReport = getRes?.data?.data;
        const isReportFresh =
          existingReport &&
          !existingReport.isStale &&
          (activeRevision === undefined ||
            existingReport.profileRevision === undefined ||
            existingReport.profileRevision === activeRevision);

        if (getRes?.data && getRes.data.success && isReportFresh) {
          setReport(getRes.data.data);
        } else {
          // If none exists, is stale, or out of sync with current profile revision, trigger a generation
          const genRes = await api.post('/user/nutrition-report/generate');
          if (genRes.data && genRes.data.success) {
            setReport(genRes.data.data);
            const freshHistory = await api.get('/user/nutrition-report/history').catch(() => ({ data: { data: [] } }));
            setHistory(freshHistory.data?.data || []);
          } else {
            setError('Failed to load your nutrition report.');
          }
        }
      } catch (err) {
        setError(getApiErrorMessage(err, 'Unable to load your customized report. Please verify your connection.'));
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchReport();
    }
  }, [userId, applyProfile]);

  useVisiblePolling(
    async (signal) => {
      const [profileRes, historyRes, reportRes] = await Promise.all([
        api.get('/user/profile', { signal }),
        api.get('/user/nutrition-report/history', { signal }),
        api.get('/user/nutrition-report', { signal }),
      ]);
      if (signal.aborted) return;
      if (profileRes.data?.success) applyProfile(profileRes.data.data);
      setHistory(historyRes.data?.data || []);
      if (reportRes.data?.success) setReport(reportRes.data.data);
      // Background updates only read; generation remains an explicit flow.
    },
    {
      enabled: Boolean(userId) && !isLoading && !isAcknowledging && !isRegenerating,
      immediate: false,
      scopeKey: userId,
    }
  );

  const handleAcknowledge = async () => {
    if (!report || report.isStale || acknowledgmentInFlight.current) return;
    acknowledgmentInFlight.current = true;
    setError(null);
    setIsAcknowledging(true);
    let saved = Boolean(
      report.acknowledgedAt &&
      (!report.planningContext?.activeVersion || report.planningContext.activeVersion === report.version)
    );
    let navigating = false;
    try {
      if (!saved) {
        const acknowledgment = await api.post('/user/nutrition-report/acknowledge', { version: report.version });
        const receipt = acknowledgment.data?.data;
        if (!acknowledgment.data?.success || !receipt?.acknowledgedAt) {
          throw new Error('The server did not confirm acknowledgment. Please try again.');
        }
        if (currentUserId.current !== userId) return;
        saved = true;
        acknowledgmentReadiness.current = receipt.planningReadiness ?? undefined;
        setReport((current) =>
          current?.version === report.version
            ? {
                ...current,
                acknowledgedAt: receipt.acknowledgedAt,
                ...(current.planningContext
                  ? { planningContext: { ...current.planningContext, activeVersion: report.version } }
                  : {}),
              }
            : current
        );
      }

      // Confirm current server state before continuing to a meal action.
      const refreshed = await refreshSession({ showLoader: false });
      if (currentUserId.current !== userId) return;
      if (!refreshed?.reportAcknowledged) {
        setError(
          'Your acknowledgment was saved. Unable to confirm the current report status. Choose Continue to retry the account check.'
        );
        return;
      }

      const readiness = acknowledgmentReadiness.current;
      if (readiness) {
        const options = {
          description: readiness.message,
          duration: 9000,
          action: readiness.canRequestPlan
            ? undefined
            : { label: 'Review context', onClick: () => router.push(readiness.actionPath) },
        };
        if (!readiness.canRequestPlan) toast.warning(readiness.title, options);
        else if (readiness.status === 'REQUEST_ALLOWED_REVIEW_EXPECTED') toast.info(readiness.title, options);
        else toast.success(readiness.title, options);
        window.dispatchEvent(new Event('nutrimind:notifications-updated'));
      }

      // Only support the explicit internal continuation, never an arbitrary redirect URL.
      const next = new URLSearchParams(window.location.search).get('next');
      const membershipSelection = pendingMembershipSelection();
      navigating = true;
      router.push(
        membershipSelection
          ? getPostAuthDestination(refreshed)
          : readiness?.canRequestPlan === false
            ? readiness.actionPath
            : next === 'regenerate'
              ? '/meals?regenerate=true'
              : '/dashboard'
      );
    } catch (err) {
      if (currentUserId.current !== userId) return;
      const failure = (err as { response?: { data?: { errorCode?: string } } }).response?.data?.errorCode;
      if (!saved && (failure === 'MEMBERSHIP_REQUIRED' || failure === 'HEALTH_MEMBERSHIP_REQUIRED')) {
        setRequiredTier(failure === 'HEALTH_MEMBERSHIP_REQUIRED' ? 'Health' : 'Lifestyle');
        return;
      }
      if (!saved && (err as { response?: { status?: number } }).response?.status === 409) {
        setReport((current) => (current ? { ...current, isStale: true } : current));
      }
      setError(
        saved
          ? 'Your acknowledgment was saved. The account check is temporarily unavailable. Choose Continue to retry.'
          : getApiErrorMessage(err, 'Failed to acknowledge the report. Please try again.')
      );
    } finally {
      if (!navigating) {
        acknowledgmentInFlight.current = false;
        setIsAcknowledging(false);
      }
    }
  };

  const handleRegenerate = async () => {
    if (acknowledgmentInFlight.current) return;
    setError(null);
    setIsRegenerating(true);
    try {
      const response = await api.post('/user/nutrition-report/generate');
      if (!response.data?.success || !response.data.data) {
        throw new Error('The updated report was not returned.');
      }
      setReport(response.data.data);
      await refreshSession();
      const profileResponse = await api.get('/user/profile');
      if (profileResponse.data?.success) applyProfile(profileResponse.data.data);
      setHistory((await api.get('/user/nutrition-report/history')).data.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to regenerate your report. Please try again.'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleKeepPrevious = async () => {
    setIsAcknowledging(true);
    try {
      await api.post('/user/nutrition-report/keep-previous', {});
      await refreshSession();
      setRequiredTier(null);
      router.push('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Your previous report is not eligible for current planning.'));
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      await startPdfDownload('/user/nutrition-report/pdf', `KAINARA_Nutrition_Report_${user?.name || 'Member'}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the current report. Please try again.');
    }
  };

  if (isLoading) {
    return <PortalLoadingState fullScreen message="Preparing your nutrition guidance..." />;
  }

  if (!report) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 text-center text-foreground">
        <Card className="max-w-md p-8 border-border bg-card shadow-card-lg">
          <AlertTriangle className="w-12 h-12 text-status-error-text mx-auto mb-4" />
          <h3 className="mb-2 text-lg font-bold text-foreground">Report Resolution Failed</h3>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {error || 'An unexpected error occurred.'}
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
          <ReportHistory history={history} />
        </Card>
      </div>
    );
  }

  const reportMatchesCurrentProfile =
    !report.isStale && profileData
      ? hasSameRestrictionContext(report.basedOnConditions, profileData.conditions) &&
        hasSameRestrictionContext(report.basedOnAllergies, profileData.allergies)
      : false;

  if (!reportMatchesCurrentProfile) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6 text-center text-foreground">
        <Card className="max-w-lg border-border bg-card p-8 shadow-card-lg">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-status-pending-text" />
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Health context changed
          </p>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Your nutrition guidance needs an update</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your conditions, allergies, intolerances, or avoided foods changed after this report was created. The older
            guidance is hidden so it cannot conflict with your current health profile.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-xs font-semibold text-status-error-text">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={handleRegenerate} isLoading={isRegenerating} className="mt-6 w-full">
            Prepare updated guidance
          </Button>
          <ReportHistory history={history} />
        </Card>
      </div>
    );
  }

  if (report.reportPolicyVersion && report.referenceItems) {
    return (
      <>
        <div className="mx-auto max-w-3xl px-4 pt-4 text-sm text-brand-muted">
          {report.confirmationKind === 'UNCHANGED_CHECKIN' && (
            <p>
              Profile confirmed unchanged on{' '}
              {new Date(report.generatedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}. This dated report
              does not represent a new nutritionist review.
            </p>
          )}
          {report.planningContext?.activeVersion && (
            <p className="mt-2">
              Current planning report: version {report.planningContext.activeVersion}, dated{' '}
              {new Date(report.planningContext.activeGeneratedAt!).toLocaleDateString('en-PH', {
                timeZone: 'Asia/Manila',
              })}
              .{report.planningContext.pendingChanges && ' Your saved updates have not been applied to meal planning.'}
              {report.planningContext.safetyChanged &&
                ' Your health context changed; affected recommendations require revalidation.'}
            </p>
          )}
        </div>
        <Modal
          isOpen={Boolean(requiredTier)}
          onClose={() => setRequiredTier(null)}
          title={`${requiredTier} membership needed`}
          description={`Your profile updates are saved. ${requiredTier} applies these changes to your meal planning. View plans to compare benefits and checkout availability.`}
        >
          <div className="flex flex-col gap-3 py-3">
            <Link
              href="/membership?tab=plans"
              className="rounded-xl bg-brand-green px-4 py-3 text-center font-semibold text-white"
            >
              View {requiredTier} benefits
            </Link>
            {report.planningContext?.activeVersion && !report.planningContext.safetyChanged ? (
              <Button onClick={handleKeepPrevious} isLoading={isAcknowledging} variant="secondary">
                Keep my previous planning report
              </Button>
            ) : (
              <Link href="/export" className="text-center font-semibold text-brand-green">
                Continue to my saved records
              </Link>
            )}
            {error && (
              <p role="alert" className="text-status-error-text">
                {error}
              </p>
            )}
          </div>
        </Modal>
        <NutritionGuidanceDocument
          report={report}
          name={profileData?.name || user?.name || 'Member'}
          goal={profileData?.goal || 'MAINTAIN'}
          dailyCalorieTarget={profileData?.dailyCalorieTarget || 0}
          conditions={profileData?.conditions || []}
          foodRestrictions={profileData?.allergies || []}
          history={history}
          error={error}
          isAcknowledging={isAcknowledging}
          onAcknowledge={handleAcknowledge}
          onDownload={handleDownloadPDF}
          isDownloadingPdf={isDownloadingPdf}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Nutrition guidance needs an update</h1>
        <p className="mt-3">
          This report uses an older format. Prepare a current, source-linked version before continuing.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-red-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="mt-5 rounded bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isRegenerating ? 'Preparing...' : 'Prepare current guidance'}
        </button>
        <ReportHistory history={history} />
      </div>
    </main>
  );
}
