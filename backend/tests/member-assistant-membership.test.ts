import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantStaticReply, assistantDirectAction } from '../src/domain/member-assistant-information';
import { assistantMembershipBenefits } from '../src/domain/member-assistant.policy';

test('plan comparisons and suitability questions explain app access without claiming the member was assessed', () => {
  for (const question of ['what are the differences between this plan and that plan?', 'compare Free vs Lifestyle vs Health',
    'what plan is best suited for me?', 'which membership should I choose?', 'tell me about Health plan benefits',
    'What are the perks of Health?', 'Lifestyle vs Health credits', 'What about Free?']) {
    const reply = assistantStaticReply(question); assert.ok(reply, question);
    assert.match(reply.text, /Free 5, Lifestyle 15, Health 30/, question);
    assert.match(reply.text, /separate allowances/, question);
    assert.match(reply.text, /not inferred your profile/, question);
    assert.ok(reply.links.some(link => link.href === '/membership'), question);
  }
  const current = assistantStaticReply('what is my current membership?');
  assert.match(current!.text, /not checked or inferred your entitlement/);
  assert.doesNotMatch(current!.text, /you (?:have|are on) Health/i);
});

test('declared conditions explain Health access and clearance; treatment questions are not subscription advice', () => {
  for (const question of ['I have diabetes can I just go with Lifestyle?', 'Can I use Lifestyle with hypertension?',
    'I have kidney disease, is the Free plan enough?']) {
    const reply = assistantStaticReply(question); assert.ok(reply, question);
    assert.match(reply.text, /requires Health access.*RND clearance/, question);
    assert.match(reply.text, /Lifestyle does not unlock/, question);
    assert.match(reply.text, /does not automatically approve/, question);
  }
  for (const question of ['what should I eat with diabetes on Lifestyle?', 'How much protein is safe with kidney disease?',
    'How can a healthy lifestyle affect nutrition?', 'nutrition facts of adobo', 'Maghanap ng ulam na manok',
    'Ano ang nutrition facts ng pandesal?']) assert.equal(assistantStaticReply(question), null, question);
});

test('Tagalog and Taglish cover membership, trial, navigation and credits with fixed destinations', () => {
  for (const question of ['Ano ang pagkakaiba ng Lifestyle at Health?', 'Aling membership ang bagay sa akin?',
    'Anong plan ang piliin ko?', 'Ano ang perks ng Health?']) {
    const reply = assistantStaticReply(question); assert.ok(reply, question);
    assert.match(reply.text, /Default Nara AI credits bawat linggo/, question);
    assert.ok(reply.links.some(link => link.href === '/membership'));
  }
  assert.match(assistantStaticReply('May diabetes ako, pwede ba Lifestyle?')!.text, /kailangan ang Health access/);
  assert.match(assistantStaticReply('Paano nagsisimula ang membership trial?')!.text, /unang cleared current meal plan/);
  assert.match(assistantStaticReply('Magkano ang Health plan?')!.text, /kasalukuyang presyo/);
  assert.match(assistantStaticReply('Paano gumagana ang AI credits?')!.text, /Lunes, 12:00 AM/);
  for (const [question, href] of [['Saan ko puwedeng baguhin ang kondisyon ko?', '/profile/health'],
    ['Paano iupdate ang timbang ko?', '/progress'], ['Paano magreport ng issue?', '/help']])
    assert.ok(assistantStaticReply(question)?.links.some(link => link.href === href), question);
  assert.match(assistantStaticReply('Marunong ka ba mag Tagalog?')!.text, /Tagalog o Taglish/);
});

test('short greetings are free without swallowing an attached question', () => {
  for (const question of ['yo', 'yow', 'wassup', 'wzp', 'sup', 'yo Nara!', 'what’s up?', 'kumusta', 'magandang umaga'])
    assert.equal(assistantDirectAction(question), 'GREETING', question);
  for (const question of ['yo what is protein?', 'wassup find chicken dinner', 'hello compare membership plans'])
    assert.notEqual(assistantDirectAction(question), 'GREETING', question);
  assert.match(assistantStaticReply('kumusta')!.text, /Kumusta/);
  assert.match(assistantStaticReply('something unclear')!.text, /Tell me the page/);
  assert.doesNotMatch(assistantStaticReply('something unclear')!.text, /Membership/);
});

test('public credit benefits expose configured amounts only when enabled and share admission defaults', () => {
  assert.deepEqual(assistantMembershipBenefits({}), { enabled: false });
  assert.deepEqual(assistantMembershipBenefits({ MEMBER_ASSISTANT_ENABLED: 'true' }), {
    enabled: true, weeklyCredits: { FREE: 5, LIFESTYLE: 15, HEALTH: 30 },
  });
  assert.deepEqual(assistantMembershipBenefits({ MEMBER_ASSISTANT_ENABLED: 'true', MEMBER_ASSISTANT_HEALTH_WEEKLY_CREDITS: '9' }), {
    enabled: true, weeklyCredits: { FREE: 5, LIFESTYLE: 15, HEALTH: 9 },
  });
});
