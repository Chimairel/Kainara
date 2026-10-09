'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useRef, useState } from 'react';

import api from '@/lib/axios';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

import {
  Person,
  DocumentItem,
  ProfileReview,
  PersonDetail,
  DocumentDetail,
  factCodes,
  ConditionAssessmentDraft,
} from './ProfileWorkPanel.shared';
export function useProfileWorkPanelModel() {
  const ownerId = useAuth().user?.userId;
  const cachedPeople = readSessionResource<Person[]>(ownerId, 'nutritionist-profile-work', 30_000);
  const [people, setPeople] = useState<Person[]>(cachedPeople ?? []);
  const [isLoading, setIsLoading] = useState(!cachedPeople);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [selection, setSelection] = useState<{ kind: 'report' | 'document'; id: string } | null>(null);
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [conditionAssessments, setConditionAssessments] = useState<ConditionAssessmentDraft[]>([]);
  const [requestArea, setRequestArea] = useState('');
  const [decision, setDecision] = useState<'SUFFICIENT' | 'NEEDS_CLARIFICATION' | 'UNUSABLE'>('NEEDS_CLARIFICATION');
  const [rationale, setRationale] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [confirmedFactIds, setConfirmedFactIds] = useState<string[]>([]);
  const [factCode, setFactCode] = useState('OTHER');
  const [factValue, setFactValue] = useState('');
  const [confirmedFacts, setConfirmedFacts] = useState<Array<{ code: string; valueText: string }>>([]);
  useEffect(() => {
    setConditionAssessments([]);
    setNotes('');
  }, [detail?.profileReview?.scopeKey, detail?.profileReview?.profileRevision]);

  const detailRef = useRef(detail);
  detailRef.current = detail;
  const queueRequest = useRef(0);
  const selectionRequest = useRef(0);
  const clearSelection = useCallback(() => {
    selectionRequest.current += 1;
    detailRef.current = null;
    setDetail(null);
    setSelection(null);
    setDocumentDetail(null);
    setFileUrl(null);
    setExpanded(false);
    setNotes('');
    setConditionAssessments([]);
  }, []);
  const noLongerQueued = (cause: unknown) =>
    ['PROFILE_WORK_NOT_FOUND', 'PROFILE_NOT_FOUND'].includes(getApiErrorCode(cause) ?? '');

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++queueRequest.current;
      try {
        const response = await api.get('/nutritionist/profile-work', signal ? { signal } : undefined);
        if (signal?.aborted || requestId !== queueRequest.current) return null;
        const next: Person[] = response.data.data ?? [];
        const selected = detailRef.current;
        if (selected && !next.some((person) => person.userId === selected.userId)) clearSelection();
        setPeople(next);
        writeSessionResource(ownerId, 'nutritionist-profile-work', next);
        setError(null);
        window.dispatchEvent(new Event('nutrimind:review-work-updated'));
        return next;
      } catch (cause) {
        if (!signal?.aborted && requestId === queueRequest.current)
          setError(getApiErrorMessage(cause, 'The profile queue could not be loaded.'));
        return null;
      } finally {
        if (requestId === queueRequest.current) {
          setIsLoading(false);
        }
      }
    },
    [ownerId, clearSelection]
  );
  useVisiblePolling(
    async (signal) => {
      const next = await refresh(signal);
      const selected = detailRef.current;
      if (signal.aborted || !next || !selected) return;
      try {
        const response = await api.get(`/nutritionist/profile-work/${selected.userId}`, { signal });
        if (!signal.aborted && detailRef.current?.userId === selected.userId) setDetail(response.data.data);
      } catch (cause) {
        if (signal.aborted || detailRef.current?.userId !== selected.userId) return;
        if (noLongerQueued(cause)) {
          clearSelection();
          await refresh();
        } else setError(getApiErrorMessage(cause, 'Could not refresh this profile.'));
      }
    },
    { enabled: !busy, immediate: false, scopeKey: `${ownerId}:${detail?.userId}` }
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const handleForceRefresh = () => {
      void refresh();
    };
    window.addEventListener('nutrimind:force-profile-work-refresh', handleForceRefresh);
    return () => {
      window.removeEventListener('nutrimind:force-profile-work-refresh', handleForceRefresh);
    };
  }, [refresh]);
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl]
  );

  const openPerson = async (userId: string, preserveSelection = false) => {
    const requestId = ++selectionRequest.current;
    setBusy(true);
    setError(null);
    try {
      const response = await api.get(`/nutritionist/profile-work/${userId}`);
      if (requestId !== selectionRequest.current) return;
      const next: PersonDetail = response.data.data;
      detailRef.current = next;
      setDetail(next);
      if (!preserveSelection) {
        setNotes('');
        setConditionAssessments([]);
        setSelection(next.reports.length ? { kind: 'report', id: next.reports[0].id } : null);
        setDocumentDetail(null);
        setFileUrl(null);
        setExpanded(false);
      }
      setRequestArea(next.requirements.find((item) => item.state !== 'READY')?.area ?? next.availableAreas[0] ?? '');
    } catch (cause) {
      if (requestId !== selectionRequest.current) return;
      if (noLongerQueued(cause)) {
        clearSelection();
        await refresh();
      } else setError(getApiErrorMessage(cause, 'Could not open this profile.'));
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (item: DocumentItem) => {
    if (!detail || item.status === 'WITHDRAWN') return;
    setBusy(true);
    setError(null);
    setDocumentDetail(null);
    setFileUrl(null);
    try {
      // The first request obtains the 30-minute document claim; the file endpoint checks
      // that claim again and records access before sending any bytes.
      const path = item.pending
        ? `/nutritionist/clinical-evidence/${item.id}`
        : `/nutritionist/profile-work/${detail.userId}/documents/${item.id}`;
      const claimed = await api.get(path);
      const file = await api.get(`${path}/file`, { responseType: 'blob' });
      setDocumentDetail(claimed.data.data);
      setFileUrl(URL.createObjectURL(new Blob([file.data], { type: item.mimeType })));
      setSelection({ kind: 'document', id: item.id });
      setRationale('');
      setValidUntil('');
      setDecision('NEEDS_CLARIFICATION');
      setConfirmedFactIds([]);
      setConfirmedFacts([]);
      setFactValue('');
      setFactCode(factCodes[item.area]?.[0] ?? 'OTHER');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not claim or open this document.'));
    } finally {
      setBusy(false);
    }
  };

  const afterDecision = async () => {
    const next = await refresh();
    if (detail && next?.some((person) => person.userId === detail.userId)) {
      await openPerson(detail.userId, true);
    } else {
      clearSelection();
    }
  };
  const claimProfile = async (release = false) => {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post(
        `/nutritionist/profile-reviews/${detail.userId}/${release ? 'release' : 'claim'}`
      );
      const review: ProfileReview = response.data.data;
      setDetail((current) =>
        current?.userId === detail.userId
          ? {
              ...current,
              profileReview: review,
              requirements: review.requirements,
              availableAreas: review.availableAreas,
            }
          : current
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not claim this profile.'));
    } finally {
      setBusy(false);
    }
  };
  const decideProfile = async (outcome: 'APPROVED' | 'DECLINED' | 'REQUEST_DETAILS') => {
    if (!detail?.profileReview) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${detail.userId}/decision`, {
        decision: outcome,
        notes,
        profileRevision: detail.profileReview.profileRevision,
        scopeKey: detail.profileReview.scopeKey,
        ...(outcome === 'REQUEST_DETAILS' ? { area: requestArea } : {}),
        ...(outcome === 'APPROVED' && conditionAssessments.length ? { conditionAssessments } : {}),
      });
      setNotes('');
      await afterDecision();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not record the profile decision.'));
    } finally {
      setBusy(false);
    }
  };
  const decideDocument = async () => {
    if (!documentDetail) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/nutritionist/clinical-evidence/${documentDetail.id}`, {
        decision,
        rationale,
        validUntil: decision === 'SUFFICIENT' ? validUntil : null,
        confirmedFactIds,
        unclearFactIds: [],
        confirmedFacts,
      });
      setDocumentDetail(null);
      setFileUrl(null);
      setSelection(detail?.reports.length ? { kind: 'report', id: detail.reports[0].id } : null);
      await afterDecision();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not record the document review.'));
    } finally {
      setBusy(false);
    }
  };

  const selectedReport = selection?.kind === 'report' ? detail?.reports.find((item) => item.id === selection.id) : null;
  const selectedDocument =
    selection?.kind === 'document' ? detail?.documents.find((item) => item.id === selection.id) : null;
  const profileBlocked =
    detail?.profileReview?.clarifications?.forms.some(
      (form) => form.status === 'AWAITING_MEMBER' || form.status === 'ANSWERED'
    ) ||
    (detail?.profileReview?.clarificationEntryIds
      ? detail.profileReview.clarificationEntryIds.some(
          (id) => !conditionAssessments.some((item) => item.entryId === id)
        )
      : detail?.profileReview?.needsClarification) ||
    detail?.requirements.some((item) => item.state !== 'READY') ||
    conditionAssessments.some(
      (item) =>
        item.rationale.trim().length < 10 ||
        !item.reviewedDietaryAndTreatmentEffects ||
        !item.reviewedFoodborneIllnessRisk
    );

  return {
    kind: 'ready' as const,
    detail,
    expanded,
    isLoading,
    people,
    busy,
    openPerson,
    setExpanded,
    clearSelection,
    claimProfile,
    error,
    setSelection,
    setDocumentDetail,
    setFileUrl,
    selection,
    openDocument,
    selectedReport,
    selectedDocument,
    documentDetail,
    fileUrl,
    confirmedFactIds,
    setConfirmedFactIds,
    factCode,
    setFactCode,
    factValue,
    setFactValue,
    setConfirmedFacts,
    confirmedFacts,
    decision,
    setDecision,
    validUntil,
    setValidUntil,
    rationale,
    setRationale,
    decideDocument,
    requestArea,
    setRequestArea,
    notes,
    conditionAssessments,
    setConditionAssessments,
    setNotes,
    profileBlocked,
    decideProfile,
    reloadDetail: async () => {
      if (detail) {
        await openPerson(detail.userId, true);
        await refresh();
      }
    },
  };
}
