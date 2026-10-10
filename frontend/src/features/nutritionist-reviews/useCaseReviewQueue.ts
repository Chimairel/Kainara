import { useCallback, useRef, useState, type RefObject } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { invalidateSessionResource, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import type { QueueItem } from './review-types';

export function useCaseReviewQueue(ownerId: string | undefined, liveOwner: RefObject<string | undefined>) {
  const cachedQueue = readSessionResource<QueueItem[]>(ownerId, 'nutritionist-case-queue', 30_000);
  const [queue, setQueue] = useState<QueueItem[]>(cachedQueue ?? []);
  const [isLoading, setIsLoading] = useState(!cachedQueue);
  const [queueError, setQueueError] = useState<string | null>(null);
  const queueGeneration = useRef(0);
  const queueFlight = useRef<{ ownerId: string | undefined; generation: number; request: Promise<void> } | null>(null);

  const fetchQueue = useCallback(
    (silent = false, signal?: AbortSignal, fresh = false) => {
      if (fresh) queueGeneration.current++;
      const generation = queueGeneration.current;
      if (
        queueFlight.current &&
        queueFlight.current.ownerId === ownerId &&
        queueFlight.current.generation === generation
      )
        return queueFlight.current.request;
      const load = async () => {
        if (!silent) {
          setQueueError(null);
          if (!readSessionResource<QueueItem[]>(ownerId, 'nutritionist-case-queue', 30_000)) setIsLoading(true);
        }
        try {
          const res = await api.get('/nutritionist/queue', { signal });
          if (signal?.aborted || liveOwner.current !== ownerId || generation !== queueGeneration.current) return;
          if (res.data?.success && Array.isArray(res.data.data)) {
            setQueue(res.data.data);
            setQueueError(null);
            writeSessionResource(ownerId, 'nutritionist-case-queue', res.data.data);
          } else throw new Error('Unexpected review queue response.');
        } catch (err) {
          if (!signal?.aborted && liveOwner.current === ownerId && generation === queueGeneration.current) {
            const code = (err as { code?: string } | null)?.code;
            setQueueError(
              getApiErrorMessage(
                err,
                code === 'ECONNABORTED' || code === 'ETIMEDOUT'
                  ? 'Loading the review queue took too long. Please retry.'
                  : 'The review queue could not be refreshed. Please retry.'
              )
            );
          }
        } finally {
          if (!silent && liveOwner.current === ownerId && generation === queueGeneration.current) setIsLoading(false);
        }
      };
      const request: Promise<void> = load().finally(() => {
        if (queueFlight.current?.request === request) queueFlight.current = null;
      });
      queueFlight.current = { ownerId, generation, request };
      return request;
    },
    [ownerId, liveOwner]
  );

  const resetQueue = useCallback(() => {
    queueGeneration.current++;
    queueFlight.current = null;
    const saved = readSessionResource<QueueItem[]>(ownerId, 'nutritionist-case-queue', 30_000);
    setQueue(saved ?? []);
    setQueueError(null);
    setIsLoading(!saved);
  }, [ownerId]);
  const removeFromQueue = (id: string, clearFlight = false) => {
    queueGeneration.current++;
    if (clearFlight) queueFlight.current = null;
    invalidateSessionResource(ownerId, 'nutritionist-case-queue');
    setQueue((previous) => previous.filter((meal) => meal.id !== id));
  };
  return { queue, isLoading, queueError, fetchQueue, resetQueue, removeFromQueue };
}
