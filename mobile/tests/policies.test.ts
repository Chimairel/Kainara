import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  memberGate,
  resolveApiUrl,
  manilaDate,
  validateQuestion,
  serializeQuestion,
  safeExternalUrl,
} from '../src/lib/policies.ts';
import type { MemberProfile } from '../src/lib/contracts.ts';

const ready = {
  role: 'USER',
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
  nutritionReport: { id: 'r1', acknowledgedAt: '2026-10-01', isStale: false },
} as MemberProfile;
test('API configuration is explicit and permits HTTP only for development LAN/emulator hosts', () => {
  assert.throws(() => resolveApiUrl(undefined, true), /Set EXPO/);
  assert.equal(resolveApiUrl('http://10.0.2.2:5000/api/', true), 'http://10.0.2.2:5000/api');
  assert.equal(resolveApiUrl('https://staging.example/api', false), 'https://staging.example/api');
  for (const url of [
    'http://staging.example/api',
    'https://user:secret@staging.example/api',
    'https://staging.example/api?token=secret',
    'https://staging.example',
    'file:///api',
  ])
    assert.throws(() => resolveApiUrl(url, true));
  assert.throws(() => resolveApiUrl('http://10.0.2.2:5000/api', false));
});
test('server profile readiness fails closed at each prerequisite', () => {
  assert.equal(memberGate(ready), 'ready');
  assert.equal(memberGate({ ...ready, role: 'ADMIN' }), 'staff');
  assert.equal(memberGate({ ...ready, emailVerified: false }), 'verify');
  assert.equal(memberGate({ ...ready, onboardingDone: false }), 'onboarding');
  assert.equal(memberGate({ ...ready, tosAccepted: false }), 'onboarding');
  assert.equal(memberGate({ ...ready, reportAcknowledged: undefined }), 'report');
  assert.equal(memberGate({ ...ready, reportAcknowledged: false, nutritionReport: null }), 'report');
  assert.equal(
    memberGate({
      ...ready,
      reportAcknowledged: false,
      nutritionReport: { id: 'r2', isStale: true, acknowledgedAt: '2026-10-01' },
    }),
    'report'
  );
  assert.equal(memberGate({ ...ready, nutritionReport: { id: 'new-proposal', isStale: true } }), 'ready');
  assert.equal(
    memberGate({
      ...ready,
      reportAcknowledged: undefined,
      userProfile: { revision: 2 },
      nutritionReport: { id: 'legacy', acknowledgedAt: '2026-10-01', profileRevision: 2, isStale: false },
    }),
    'ready'
  );
  assert.equal(
    memberGate({
      ...ready,
      reportAcknowledged: undefined,
      userProfile: { revision: 3 },
      nutritionReport: { id: 'legacy', acknowledgedAt: '2026-10-01', profileRevision: 2, isStale: false },
    }),
    'report'
  );
});
test('calendar dates use Manila rather than the device timezone', () => {
  assert.equal(manilaDate('2026-10-22T17:00:00Z'), '2026-10-23');
  assert.equal(manilaDate('2026-10-22T15:59:00Z'), '2026-10-22');
});
test('AI protocol preserves the serialized limit and rejects empty questions', () => {
  assert.equal(serializeQuestion(' how do I log water? ', true), '/ai how do I log water?');
  assert.equal(validateQuestion('   ', true), 'Write your question first.');
  assert.equal(validateQuestion('a'.repeat(996), true), null);
  assert.match(validateQuestion('a'.repeat(997), true)!, /1,000/);
  assert.equal(validateQuestion('a'.repeat(1000), false), null);
});
test('external links cannot invoke scripts, local files or embedded credentials', () => {
  assert.equal(safeExternalUrl('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc');
  for (const url of ['javascript:alert(1)', 'file:///secret', 'http://example.com', 'https://user:secret@example.com'])
    assert.equal(safeExternalUrl(url), null);
});
