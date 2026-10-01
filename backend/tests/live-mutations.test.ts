import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';
import { liveMutationUpdates } from '../src/middleware/liveUpdates';
import { subscribeLiveUpdates } from '../src/lib/live-updates';

test('committed relationship writes refresh audiences; failures and lookups do not', () => {
  const called = { user: 0, other: 0, admin: 0, reviewer: 0 };
  const stop = [
    subscribeLiveUpdates('patient', 'USER', () => called.user++),
    subscribeLiveUpdates('other', 'USER', () => called.other++),
    subscribeLiveUpdates('admin', 'ADMIN', () => called.admin++),
    subscribeLiveUpdates('reviewer', 'NUTRITIONIST', () => called.reviewer++),
  ];
  const finish = (url: string, status = 200, role?: 'USER' | 'ADMIN', method = 'POST') => {
    const req = {
      originalUrl: url,
      path: url,
      method,
      user: role ? { userId: role === 'USER' ? 'patient' : 'admin', role } : undefined,
    } as AuthenticatedRequest;
    const res = Object.assign(new EventEmitter(), { statusCode: status });
    const before = { ...called };
    liveMutationUpdates(req, res as unknown as Response, () => {});
    assert.deepEqual(called, before, 'Signals must wait for a successful response to finish.');
    res.emit('finish');
  };
  try {
    finish('/api/user/clinical-evidence/documents', 201, 'USER');
    assert.deepEqual(called, { user: 1, other: 0, admin: 1, reviewer: 1 });
    finish('/api/admin/nutritionist-applications/fixture/decision', 409, 'ADMIN', 'PATCH');
    finish('/api/nutritionist-applications/status');
    finish('/api/nutritionist-applications/license-availability');
    finish('/api/user/meals/current', 200, 'USER', 'GET');
    assert.deepEqual(called, { user: 1, other: 0, admin: 1, reviewer: 1 });
    finish('/api/notifications/fixture/read', 200, 'USER', 'PATCH');
    assert.deepEqual(called, { user: 2, other: 0, admin: 1, reviewer: 1 });
    finish('/api/nutritionist-applications', 201);
    assert.deepEqual(called, { user: 2, other: 0, admin: 2, reviewer: 1 });
    finish('/api/admin/nutritionist-applications/fixture/decision', 200, 'ADMIN', 'PATCH');
    assert.deepEqual(called, { user: 3, other: 1, admin: 3, reviewer: 2 });
  } finally {
    stop.forEach((unsubscribe) => unsubscribe());
  }
});
