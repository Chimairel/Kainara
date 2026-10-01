import assert from 'node:assert/strict';
import test from 'node:test';
import { publishLiveUpdate, subscribeLiveUpdates } from '../src/lib/live-updates';
test('live signals reach only their server-selected role/account audiences and unsubscribe cleanly', () => {
  const called = { patient: 0, other: 0, rnd: 0, admin: 0 };
  const stop = [
    subscribeLiveUpdates('patient', 'USER', () => called.patient++),
    subscribeLiveUpdates('other', 'USER', () => called.other++),
    subscribeLiveUpdates('reviewer', 'NUTRITIONIST', () => called.rnd++),
    subscribeLiveUpdates('admin', 'ADMIN', () => called.admin++),
  ];
  publishLiveUpdate({ userId: 'patient', roles: ['ADMIN', 'NUTRITIONIST'] });
  assert.deepEqual(called, { patient: 1, other: 0, rnd: 1, admin: 1 });
  publishLiveUpdate({ roles: ['ADMIN'] });
  assert.deepEqual(called, { patient: 1, other: 0, rnd: 1, admin: 2 });
  stop.forEach((unsubscribe) => unsubscribe());
  publishLiveUpdate({ roles: ['USER', 'NUTRITIONIST', 'ADMIN'] });
  assert.deepEqual(called, { patient: 1, other: 0, rnd: 1, admin: 2 });
});
