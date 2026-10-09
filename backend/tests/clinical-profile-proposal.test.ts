import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publishProfileProposalSchema,
  respondProfileProposalSchema,
  proposalDisplayStatus,
} from '../src/domain/clinical-profile-proposal.policy';
import { randomUUID } from 'node:crypto';
import {
  ClinicalProfileProposalService,
  hasPendingProfileProposal,
} from '../src/services/clinical-profile-proposal.service';

const context = { profileRevision: 1, scopeKey: 'current' };
const body = {
  ...context,
  requestKey: randomUUID(),
  rationale: 'Reviewed the reported clarification.',
  changes: { domains: [{ domain: 'CONDITION', entries: [{ value: 'DIABETES', provenance: 'PREDEFINED' }] }] },
};
test('profile correction schema excludes credentials, clinical approvals and duplicate sections', () => {
  assert.equal(publishProfileProposalSchema.safeParse(body).success, true);
  for (const forbidden of ['authorUserId', 'approved', 'calories'])
    assert.equal(publishProfileProposalSchema.safeParse({ ...body, [forbidden]: true }).success, false);
  assert.equal(publishProfileProposalSchema.safeParse({ ...body, changes: {} }).success, false);
  assert.equal(
    publishProfileProposalSchema.safeParse({
      ...body,
      changes: { domains: [...body.changes.domains, ...body.changes.domains] },
    }).success,
    false
  );
  assert.equal(
    publishProfileProposalSchema.safeParse({ ...body, changes: { domains: [{ domain: 'CONDITION', entries: [] }] } })
      .success,
    false
  );
});
test('member correction requests require explanation and bind to the displayed context', () => {
  const respond = {
    ...context,
    requestKey: randomUUID(),
    decision: 'REQUEST_CORRECTION',
    note: 'This is incorrect; please clarify.',
  };
  assert.equal(respondProfileProposalSchema.safeParse(respond).success, true);
  assert.equal(respondProfileProposalSchema.safeParse({ ...respond, note: '' }).success, false);
  assert.equal(respondProfileProposalSchema.safeParse({ ...respond, profileRevision: 0 }).success, false);
  assert.equal(respondProfileProposalSchema.safeParse({ ...respond, decision: 'NONE' }).success, false);
});
test('stale pending proposals become history without rewriting accepted attribution', () => {
  assert.equal(
    proposalDisplayStatus({ ...context, status: 'PENDING' }, { ...context, profileRevision: 2 }),
    'SUPERSEDED'
  );
  assert.equal(
    proposalDisplayStatus({ ...context, status: 'CORRECTION_REQUESTED' }, { ...context, scopeKey: 'changed' }),
    'SUPERSEDED'
  );
  assert.equal(
    proposalDisplayStatus({ ...context, status: 'ACCEPTED' }, { ...context, profileRevision: 2 }),
    'ACCEPTED'
  );
});
test('disabled correction rollout never accesses the pending proposal table', async () => {
  assert.deepEqual(await ClinicalProfileProposalService.list('not-looked-up'), {
    enabled: false,
    proposals: [],
    editableInputs: [],
  });
  assert.equal(
    await hasPendingProfileProposal('not-looked-up', context, {
      clinicalProfileProposal: {
        count: () => {
          throw new Error('Unmigrated table accessed');
        },
      },
    } as any),
    false
  );
});
