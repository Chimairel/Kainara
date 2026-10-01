import assert from 'node:assert/strict';
import test from 'node:test';
import { formatApplicationTime } from '../src/domain/application-time';
import { applicationLicenseLookupSchema } from '../src/validation/nutritionist-application.schemas';
test('verification schedule uses explicit Philippine time including midnight rollover', () => {
  assert.match(formatApplicationTime('2026-10-01T15:54:00Z'), /October 1, 2026.*11:54 PM.*Philippine time/);
  assert.match(formatApplicationTime('2026-10-01T16:02:00Z'), /October 2, 2026.*12:02 AM.*UTC\+8/);
});
test('license availability rejects unbounded, malformed and identity-disclosing lookup fields', () => {
  assert.equal(applicationLicenseLookupSchema.safeParse({ prcLicenseNumber: 'RND-12345' }).success, true);
  for (const value of ['', '1234', '12/345', 'x'.repeat(81)])
    assert.equal(applicationLicenseLookupSchema.safeParse({ prcLicenseNumber: value }).success, false);
  assert.equal(
    applicationLicenseLookupSchema.safeParse({ prcLicenseNumber: 'RND-12345', email: 'private@example.test' }).success,
    false
  );
});
