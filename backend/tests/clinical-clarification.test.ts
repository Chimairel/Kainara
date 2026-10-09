import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  clarificationQuestionsSchema,
  publishClarificationSchema,
  answerClarificationSchema,
  validateClarificationAnswers,
  clarificationDisplayState,
  type ClarificationQuestion,
} from '../src/domain/clinical-clarification.policy';
import {
  ClinicalClarificationService,
  hasUnresolvedClarifications,
} from '../src/services/clinical-clarification.service';

const questions: ClarificationQuestion[] = [
  { id: 'diagnosis', label: 'What diagnosis is recorded?', type: 'TEXT', required: true },
  { id: 'change', label: 'Has your information changed?', type: 'CHOICE', options: ['Yes', 'No'], required: true },
  { id: 'extra', label: 'Any additional information?', type: 'TEXT', required: false },
];

test('clarification questions require bounded unique identities and valid choices', () => {
  assert.equal(clarificationQuestionsSchema.safeParse(questions).success, true);
  for (const invalid of [
    [],
    [...questions, questions[0]],
    questions.map((q) => ({ ...q, required: false })),
    [{ ...questions[1], options: ['Yes', 'Yes'] }],
    [{ ...questions[0], label: 'x'.repeat(501) }],
    [{ ...questions[0], id: '__proto__' }],
    [{ ...questions[0], id: 'constructor' }],
    Array.from({ length: 13 }, (_, i) => ({ ...questions[0], id: String(i) })),
  ])
    assert.equal(clarificationQuestionsSchema.safeParse(invalid).success, false);
});

test('required answers and explicit choices fail closed; extra fields cannot classify a profile', () => {
  assert.equal(validateClarificationAnswers(questions, { diagnosis: 'Recorded answer', change: 'No' }), true);
  for (const invalid of [
    { diagnosis: '', change: 'No' },
    { diagnosis: 'Recorded answer', change: 'Maybe' },
    { diagnosis: 'Recorded answer', change: 'No', profileCondition: 'NONE' },
    { diagnosis: 'x'.repeat(2001), change: 'No' },
  ])
    assert.equal(validateClarificationAnswers(questions, invalid as Record<string, string>), false);
});

test('forms and answers require expected context and strict payloads with retry keys', () => {
  const published = {
    profileRevision: 2,
    scopeKey: 'scope',
    title: 'Review details',
    questions,
    requestKey: randomUUID(),
  };
  assert.equal(publishClarificationSchema.safeParse(published).success, true);
  assert.equal(publishClarificationSchema.safeParse({ ...published, authorUserId: 'spoof' }).success, false);
  assert.equal(
    answerClarificationSchema.safeParse({
      profileRevision: 2,
      scopeKey: 'scope',
      answers: {},
      requestKey: randomUUID(),
      expectedResponseId: null,
    }).success,
    true
  );
  assert.equal(
    answerClarificationSchema.safeParse({
      profileRevision: 2,
      scopeKey: 'scope',
      answers: {},
      requestKey: randomUUID(),
    }).success,
    false
  );
});

test('changed profile or clinical scope supersedes even resolved historical forms', () => {
  const recorded = { profileRevision: 2, scopeKey: 'scope' };
  assert.equal(clarificationDisplayState(recorded, recorded, false, false), 'AWAITING_MEMBER');
  assert.equal(clarificationDisplayState(recorded, recorded, true, false), 'ANSWERED');
  assert.equal(clarificationDisplayState(recorded, recorded, true, true), 'RESOLVED');
  assert.equal(clarificationDisplayState(recorded, { ...recorded, profileRevision: 3 }, true, true), 'SUPERSEDED');
  assert.equal(clarificationDisplayState(recorded, { ...recorded, scopeKey: 'changed' }, true, false), 'SUPERSEDED');
});

test('disabled rollout does not access unmigrated clarification tables', async () => {
  assert.equal(ClinicalClarificationService.enabled, false);
  assert.deepEqual(await ClinicalClarificationService.list('not-looked-up'), { enabled: false, forms: [] });
  assert.equal(
    await hasUnresolvedClarifications('not-looked-up', { profileRevision: 1, scopeKey: 'scope' }, {
      clinicalClarificationForm: {
        count: () => {
          throw new Error('Unmigrated table accessed');
        },
      },
    } as any),
    false
  );
});
