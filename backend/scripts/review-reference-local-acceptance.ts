import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
/** Fresh loopback-only HTTP/SQL acceptance; no shared data or external providers. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Role, Prisma, HealthConditionType, ClinicalEvidenceArea } from '@prisma/client';
import app from '../src/app';
import db from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';
import { loadMealReviewContext } from '../src/services/meal-case-context.service';
import { MealLogService } from '../src/services/meal-log.service';

export async function runReviewReferenceAcceptance() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert(['55488', '55432'].includes(target.port));
  assert(
    target.pathname === '/kainara_review_references' ||
      (target.port === '55432' && /^\/kainara_exact_reuse_[a-f0-9]{8}$/.test(target.pathname))
  );
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true');
  assert.equal(process.env.MEMBERSHIP_ENABLED, 'false');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert(!(process.env[key] ?? '').trim(), `External provider ${key} must be disabled.`);
  assert.equal(await db.user.count(), 0, 'Use a fresh task-owned database.');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1', 'No external calls');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const account = (role: Role) =>
    db.user.create({
      data: {
        role,
        name: `Synthetic ${role}`,
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'NON_LOGIN_FIXTURE',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
      },
    });
  type Actor = Awaited<ReturnType<typeof account>>;
  const request = async (actor: Actor, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
  };
  const checks: string[] = [];
  const pass = (name: string) => {
    checks.push(name);
    console.log(`PASS ${name}`);
  };
  try {
    const member = await account('USER'),
      rnd = await account('NUTRITIONIST'),
      other = await account('NUTRITIONIST'),
      admin = await account('ADMIN');
    const reviewer = await db.nutritionistProfile.create({
      data: { userId: rnd.id, isVerified: true, prcLicenseNumber: rnd.id, prcLicenseExpiry: new Date('2099-01-01') },
    });
    const certifier = await db.nutritionistProfile.create({
      data: {
        userId: other.id,
        isVerified: true,
        prcLicenseNumber: other.id,
        prcLicenseExpiry: new Date('2099-01-01'),
      },
    });
    const now = new Date();
    const profile = await db.userProfile.create({
      data: {
        userId: member.id,
        revision: 1,
        safetyRevision: 1,
        age: 28,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        targetWeightKg: 65,
        foodCulture: 'Filipino',
        shoppingDayOfWeek: 6,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        ricePreference: 'WITH_RICE',
        dailyCalorieTarget: 2000,
        planningReportVersion: 1,
      },
    });
    for (const domain of ['CONDITION', 'ALLERGY'] as const)
      await db.safetyProfileEntry.create({
        data: {
          userId: member.id,
          domain,
          canonicalCode: 'NONE',
          displayName: 'None',
          originalText: 'None',
          normalizedText: 'none',
          provenance: 'PREDEFINED',
          supportState: 'SUPPORTED',
          policyReference: 'STRUCTURED_RESTRICTIONS_V1',
        },
      });
    await db.healthCondition.create({ data: { userId: member.id, condition: 'NONE' } });
    await db.allergy.create({ data: { userId: member.id, allergen: 'NONE' } });
    await db.nutritionReport.create({
      data: {
        userId: member.id,
        version: 1,
        profileRevision: 1,
        acknowledgedAt: now,
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        generalSummary: 'Synthetic guidance',
        basedOnConditions: [],
        basedOnAllergies: [],
      },
    });
    await db.nutritionReportVersion.create({
      data: {
        userId: member.id,
        version: 1,
        profileRevision: 1,
        acknowledgedAt: now,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: {},
        profileSnapshot: { profile: JSON.parse(JSON.stringify(profile)) },
      },
    });
    const rice = await db.foodItem.create({
      data: {
        name: 'Rice, well-milled, boiled',
        source: 'FNRI',
        category: 'GRAINS',
        calories: 130,
        proteinG: 2,
        carbsG: 28,
        fatG: 0.1,
        sodium: 10,
        sugar: 0,
        fiber: 1,
        potassium: 20,
        phosphorus: 10,
        saturatedFat: 0,
      },
    });
    const food = await db.foodItem.create({
      data: {
        name: 'Synthetic vegetable',
        source: 'FNRI',
        category: 'PRODUCE',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
      },
    });
    const library = async (name: string, sugarG: number | null = 10, verified = true) => {
      const ingredients = [
        {
          ingredientName: food.name,
          foodItemId: food.id,
          quantity: 300,
          unit: 'g',
          category: 'PRODUCE',
          dataSource: 'FNRI' as const,
          position: 0,
        },
      ];
      const nutrition = { calories: 600, proteinG: 30, carbsG: 60, fatG: 15 };
      const signature = buildMealLibraryRecipeSignature({
        mealName: name,
        mealType: 'LUNCH',
        ...nutrition,
        ingredients,
      });
      const meal = await db.mealLibrary.create({
        data: {
          mealName: name,
          mealType: 'LUNCH',
          ...nutrition,
          sugarG,
          sodiumMg: 100,
          fiberG: 5,
          potassiumMg: 200,
          phosphorusMg: 80,
          saturatedFatG: 2,
          description: 'Synthetic measured fixture',
          status: 'APPROVED',
          dietaryTags: ['OMNIVORE'],
          recipeSignature: signature,
          verifiedByNutritionistId: certifier.id,
          safetyReviewedByNutritionistId: certifier.id,
          safetyReviewedAt: now,
          safetyEvidenceStatus: 'COMPLETE',
          safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
          safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
          safetyEvidenceRevision: 1,
          certifiedEvidenceRevision: 1,
          conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
          allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
          crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
          nutritionEvidenceSource: 'FNRI_RECONCILED',
          nutritionServingDescription: '300 g',
          riceRole: 'PAIR_WITH_RICE',
          riceRoleReviewStatus: 'REVIEWED',
          applicableMealTypes: { create: { mealType: 'LUNCH' } },
          ingredients: { create: ingredients },
        },
      });
      if (verified)
        await db.mealBaseVerification.create({
          data: {
            targetKind: 'LIBRARY_MEAL',
            targetId: meal.id,
            revisionKey: libraryBaseRevisionKey(signature, meal.description),
            status: 'VERIFIED',
            reviewedByNutritionistId: certifier.id,
            reviewedAt: now,
            rationale: 'Synthetic base verification.',
          },
        });
      return meal;
    };
    const eligible = await library('Exact measured recipe', 0);
    const cloneProfile = async () => {
      const actor = await account('USER');
      const fields = Object.fromEntries(
        Object.entries(profile).filter(([key]) => !['id', 'userId', 'updatedAt'].includes(key))
      ) as Omit<typeof profile, 'id' | 'userId' | 'updatedAt'>;
      const p = await db.userProfile.create({ data: { ...fields, userId: actor.id } });
      for (const domain of ['CONDITION', 'ALLERGY'] as const)
        await db.safetyProfileEntry.create({
          data: {
            userId: actor.id,
            domain,
            canonicalCode: 'NONE',
            displayName: 'None',
            originalText: 'None',
            normalizedText: 'none',
            provenance: 'PREDEFINED',
            supportState: 'SUPPORTED',
            policyReference: 'STRUCTURED_RESTRICTIONS_V1',
          },
        });
      await db.healthCondition.create({ data: { userId: actor.id, condition: 'NONE' } });
      await db.allergy.create({ data: { userId: actor.id, allergen: 'NONE' } });
      await db.nutritionReport.create({
        data: {
          userId: actor.id,
          version: 1,
          profileRevision: 1,
          acknowledgedAt: now,
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          generalSummary: 'Different private guidance',
          basedOnConditions: [],
          basedOnAllergies: [],
        },
      });
      await db.nutritionReportVersion.create({
        data: {
          userId: actor.id,
          version: 1,
          profileRevision: 1,
          acknowledgedAt: now,
          policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
          content: {},
          profileSnapshot: { profile: JSON.parse(JSON.stringify(p)) },
        },
      });
      return actor;
    };
    const second = await cloneProfile();
    const makeSlot = async (actor: Actor) => {
      const start = new Date(now.getTime() + 86400000);
      const cycle = await db.mealPlanCycle.create({
        data: {
          id: randomUUID(),
          userId: actor.id,
          planType: 'WEEKLY',
          startDate: start,
          endDate: new Date(start.getTime() + 86400000),
          preparationOpensAt: now,
          shoppingDeadlineAt: now,
          expectedSlotCount: 1,
          snapshot: {
            create: {
              userId: actor.id,
              profileRevision: 1,
              safetyRevision: 1,
              nutritionReportVersion: 1,
              weightKg: 65,
              activityLevel: 'SEDENTARY',
              goal: 'MAINTAIN',
              dailyCalorieTarget: 2000,
              dailyMacroTargets: {},
              dietaryPreference: 'OMNIVORE',
              ricePreference: 'WITH_RICE',
              planningGeographyLevel: 'NATIONAL',
            },
          },
        },
      });
      const plan = await db.mealPlan.create({
        data: {
          userId: actor.id,
          planGroupId: cycle.id,
          mealType: 'LUNCH',
          mealName: 'Original pending candidate',
          calories: 800,
          proteinG: 40,
          carbsG: 80,
          fatG: 20,
          scheduledDate: start,
          status: 'PENDING_REVIEW',
          claimedByNutritionistId: reviewer.id,
          claimedAt: now,
        },
      });
      const key = (await loadMealReviewContext(plan.id))!.contextKey;
      const options = await ok(
        request(
          rnd,
          `/nutritionist/queue/${plan.id}/swap-options?` +
            new URLSearchParams({ expectedContextKey: key, filters: '{}' })
        )
      );
      const selected = options.options.find((item: any) => item.id === eligible.id);
      assert(selected);
      const swapped = await ok(
        request(rnd, `/nutritionist/queue/${plan.id}/swap`, 'POST', {
          libraryMealId: selected.id,
          expectedContextKey: key,
          expectedVersion: options.expectedVersion,
          expectedRecipeSignature: selected.recipeSignature,
          expectedEvidenceRevision: selected.evidenceRevision,
          expectedServingKey: selected.servingKey,
          filters: options.filters,
          note: 'Selected measured complete serving for separate review.',
        })
      );
      return db.mealPlan.findUniqueOrThrow({ where: { id: swapped.replacementPlanId } });
    };
    const first = await makeSlot(member);
    const open = await ok(request(rnd, `/nutritionist/queue/${first.id}`));
    await ok(
      request(rnd, `/nutritionist/queue/${first.id}/claim`, 'POST', {
        expectedContextKey: open.reviewContext.contextKey,
      })
    );
    await ok(
      request(rnd, `/nutritionist/review/${first.id}`, 'PATCH', {
        action: 'approve',
        expectedContextKey: open.reviewContext.contextKey,
        note: 'Private note which must never be returned to another member case.',
      })
    );
    assert.equal(await db.mealReviewReference.count(), 1);
    const fresh = await makeSlot(second);
    await ok(request(rnd, `/nutritionist/queue/${fresh.id}/release`, 'POST', {}));
    const preview = () => ok(request(other, `/nutritionist/queue/${fresh.id}`));
    const detail = await preview();
    assert.equal(detail.reviewReferences.length, 1);
    assert.equal((await db.mealPlan.findUniqueOrThrow({ where: { id: fresh.id } })).status, 'PENDING_REVIEW');
    assert.deepEqual(
      Object.keys(detail.reviewReferences[0]).sort(),
      ['decision', 'match', 'plateFacts', 'reviewedAt', 'reviewerName', 'use'].sort()
    );
    const text = JSON.stringify(detail.reviewReferences);
    for (const privateValue of [
      member.id,
      member.email,
      first.id,
      first.planGroupId,
      'Private note',
      'Different private guidance',
    ])
      assert(!text.includes(privateValue));
    assert.equal((await request(second, `/nutritionist/queue/${fresh.id}`)).status, 403);
    pass(
      'Prior-review inspection exposes only public reference facts; member access to staff case details is denied'
    );
    for (const [field, value] of [
      ['age', 29],
      ['weightKg', 64],
      ['goal', 'LOSE_WEIGHT'],
    ] as const) {
      await db.userProfile.update({ where: { userId: second.id }, data: { [field]: value } });
      // Matching is checked independently of the acknowledged guidance gate.
      const opened = (await loadMealReviewContext(fresh.id))!;
      const { listReviewReferences } = await import('../src/services/reusable-review-reference.service');
      assert.equal((await listReviewReferences(opened, certifier.id)).length, 0);
      await db.userProfile.update({ where: { userId: second.id }, data: { [field]: profile[field] } });
    }
    pass('Age, weight and goal differences never use approximate matching');
    await db.userProfile.update({ where: { userId: member.id }, data: { age: 40, revision: 2 } });
    assert.equal((await preview()).reviewReferences.length, 1);
    pass('The original reviewed context remains fixed when its member later changes profile');
    await db.foodItem.update({ where: { id: rice.id }, data: { compositionRevision: 1 } });
    assert.equal((await preview()).reviewReferences.length, 0);
    await db.foodItem.update({ where: { id: rice.id }, data: { compositionRevision: 0 } });
    await db.mealLibrary.update({ where: { id: eligible.id }, data: { sugarG: 1 } });
    assert.equal((await preview()).reviewReferences.length, 0);
    await db.mealLibrary.update({ where: { id: eligible.id }, data: { sugarG: 0 } });
    await db.mealPlanServingComponent.updateMany({
      where: { mealPlanId: fresh.id },
      data: { quantityG: { increment: 1 } },
    });
    assert.equal((await preview()).reviewReferences.length, 0);
    await db.mealPlanServingComponent.updateMany({
      where: { mealPlanId: fresh.id },
      data: { quantityG: { decrement: 1 } },
    });
    pass(
      'Changed side portions, composition revisions and source nutrient evidence invalidate the exact serving match'
    );
    const lineage = await db.mealReviewLineage.create({ data: { key: `recipe:${eligible.id}`, state: 'QUARANTINED' } });
    assert.equal((await preview()).reviewReferences.length, 0);
    await db.mealReviewLineage.update({ where: { id: lineage.id }, data: { state: 'PUBLISHED' } });
    await db.nutritionistProfile.update({ where: { id: reviewer.id }, data: { prcLicenseExpiry: new Date(0) } });
    assert.equal((await preview()).reviewReferences.length, 0);
    await db.nutritionistProfile.update({
      where: { id: reviewer.id },
      data: { prcLicenseExpiry: new Date('2099-01-01') },
    });
    await db.mealPlan.update({ where: { id: first.id }, data: { status: 'DISPUTED' } });
    assert.equal((await preview()).reviewReferences.length, 0);
    await db.mealPlan.update({ where: { id: first.id }, data: { status: 'APPROVED' } });
    pass('Quarantined recipes, expired decision reviewers and challenged source decisions never supply references');
    const { MealPlanCycleService } = await import('../src/services/meal-plan-cycle.service');
    const { context, userInclude, scopedPolicy } = await import('../src/services/clinical-profile-review.context');
    const { evidenceAreaForCondition } = await import('../src/domain/clinical-evidence-requirement.policy');
    const { matchingReviewKeys } = await import('../src/services/reusable-review-reference.service');
    const { StaffAuditService } = await import('../src/services/staff-audit.service');
    const configure = async (actor: Actor, condition: HealthConditionType, allergic: boolean) => {
      await db.healthCondition.updateMany({ where: { userId: actor.id }, data: { condition } });
      await db.safetyProfileEntry.updateMany({
        where: { userId: actor.id, domain: 'CONDITION' },
        data: {
          canonicalCode: condition,
          displayName: condition,
          originalText: condition,
          normalizedText: condition.toLowerCase(),
        },
      });
      if (allergic) {
        await db.allergy.updateMany({ where: { userId: actor.id }, data: { allergen: 'NUTS' } });
        await db.safetyProfileEntry.updateMany({
          where: { userId: actor.id, domain: 'ALLERGY' },
          data: {
            canonicalCode: 'NUTS',
            displayName: 'Nuts',
            originalText: 'Nuts',
            normalizedText: 'nuts',
          },
        });
      }
      const areas: ClinicalEvidenceArea[] = [
        ...(evidenceAreaForCondition(condition) ? [evidenceAreaForCondition(condition)!] : []),
        ...(allergic ? ['FOOD_ALLERGY' as const] : []),
      ];
      for (const area of areas)
        await db.clinicalContextResponse.create({
          data: {
            userId: actor.id,
            area,
            responses: {
              formVersion: 'HEALTH_DETAILS_V1',
              safetyRevision: 1,
              conditionDetails: 'SYNTHETIC_PRIVATE_CLINICAL_CANARY',
              medications: 'Synthetic medication',
              dietaryAdvice: 'Synthetic advice',
              recentSymptoms: 'None',
              measurements: 'Synthetic measurement',
            },
          },
        });
      const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, include: userInclude });
      const current = context(user);
      await db.clinicalProfileReview.create({
        data: {
          id: randomUUID(),
          userId: actor.id,
          profileRevision: 1,
          policyVersion: scopedPolicy(current.scopeKey),
          status: 'APPROVED',
          profileSnapshot: current.snapshot,
          reasonCodes: [],
          reviewerId: reviewer.id,
          reviewedAt: now,
        },
      });
    };
    const conditions: HealthConditionType[] = [
      'DIABETES',
      'HYPERTENSION',
      'KIDNEY_DISEASE',
      'HEART_CONDITION',
      'PREGNANT',
    ];
    for (const [index, condition] of conditions.entries()) {
      const sourceActor = await cloneProfile(),
        targetActor = await cloneProfile();
      const sourcePlan = await makeSlot(sourceActor),
        targetPlan = await makeSlot(targetActor);
      let sourceId: string | null = null;
      if (index === 2) {
        const raw = await db.rawRecipeCandidate.create({ data: {
          sourceRecordId: randomUUID(), sourceUrl: 'https://example.invalid/synthetic-reuse-recipe',
          recipeName: 'Synthetic raw recipe', normalizedName: 'synthetic raw recipe',
          contentSignature: 'f'.repeat(64), cuisines: [], dietaryTags: [], ingredients: [],
          mealType: 'LUNCH', publishedNutrition: { calories: sourcePlan.calories },
        } });
        sourceId = raw.id;
        await db.mealPlan.updateMany({ where: { id: { in: [sourcePlan.id, targetPlan.id] } }, data: {
          libraryMealId: null, profileApprovalId: null, sourceRawRecipeCandidateId: raw.id,
          candidateProvenance: 'RAW_RECIPE_CORPUS',
        } });
      }
      if (index === 4) {
        await db.mealBaseVerification.create({ data: { targetKind: 'GENERATED_RECIPE',
          targetId: sourcePlan.baseRecipeSignature!, revisionKey: sourcePlan.baseRecipeSignature!,
          status: 'VERIFIED', reviewedByNutritionistId: certifier.id, reviewedAt: now,
        } });
        await db.mealPlan.updateMany({ where: { id: { in: [sourcePlan.id, targetPlan.id] } }, data: {
          libraryMealId: null, profileApprovalId: null, candidateProvenance: 'AI_FROM_SCRATCH',
        } });
      }
      await configure(sourceActor, condition, index === 0);
      await configure(targetActor, condition, index === 0);
      if (index === 3) await db.mealLibrary.update({ where: { id: eligible.id }, data: { safetyReviewedByNutritionistId: null } });
      const current = (await loadMealReviewContext(sourcePlan.id))!;
      await ok(
        request(rnd, `/nutritionist/queue/${sourcePlan.id}/claim`, 'POST', { expectedContextKey: current.contextKey })
      );
      await ok(
        request(rnd, `/nutritionist/review/${sourcePlan.id}`, 'PATCH', {
          action: 'approve',
          expectedContextKey: current.contextKey,
          note: 'SYNTHETIC_PRIVATE_REVIEW_NOTE',
        })
      );
      await ok(request(rnd, `/nutritionist/queue/${targetPlan.id}/release`, 'POST', {}));
      if (index === 0) {
        // Captured V1 contexts can reuse without a new RND decision, with V2 document-digest validation.
        const sourceKeys = (await matchingReviewKeys(db, current))!;
        await db.mealReviewReference.update({
          where: {
            decisionId: (
              await db.mealPlanReviewDecision.findFirstOrThrow({
                where: { mealPlanId: sourcePlan.id },
                orderBy: { submittedAt: 'desc' },
              })
            ).id,
          },
          data: { policyVersion: 'EXACT_REVIEW_REFERENCE_V1', contextKey: sourceKeys.legacyContextKey! },
        });
        const clear = () => MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId);
        await db.userProfile.update({ where: { userId: targetActor.id }, data: { age: 29 } });
        assert(!(await clear()).includes(targetPlan.id));
        await db.userProfile.update({ where: { userId: targetActor.id }, data: { age: 28 } });
        await db.mealIngredient.updateMany({
          where: { mealPlanId: targetPlan.id },
          data: { quantity: { increment: 1 } },
        });
        assert(!(await clear()).includes(targetPlan.id));
        await db.mealIngredient.updateMany({
          where: { mealPlanId: targetPlan.id },
          data: { quantity: { decrement: 1 } },
        });
        await db.mealPlan.update({
          where: { id: targetPlan.id },
          data: { claimedByNutritionistId: reviewer.id, claimedAt: now },
        });
        assert(!(await clear()).includes(targetPlan.id));
        await db.mealPlan.update({
          where: { id: targetPlan.id },
          data: { claimedByNutritionistId: null, claimedAt: null },
        });
        await db.clinicalProfileReview.updateMany({ where: { userId: targetActor.id }, data: { status: 'PENDING' } });
        assert(!(await clear()).includes(targetPlan.id));
        await db.clinicalProfileReview.updateMany({ where: { userId: targetActor.id }, data: { status: 'APPROVED' } });
        pass('Changed profile, ingredient amount, active claim, and unconfirmed health profile cannot auto-approve');
      }
      const [cleared, retry] = await Promise.all([
        MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId),
        MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId),
      ]);
      assert(cleared.includes(targetPlan.id) && retry.includes(targetPlan.id));
      assert.equal((await db.mealPlan.findUniqueOrThrow({ where: { id: targetPlan.id } })).status, 'APPROVED');
      assert.equal(await db.mealPlanReviewDecision.count({ where: { mealPlanId: targetPlan.id } }), 0);
      assert.equal(await db.mealLog.count({ where: { mealPlanId: targetPlan.id } }), 0);
      assert.equal(
        await db.auditEvent.count({ where: { entityId: targetPlan.id, action: 'MEAL_APPROVAL_REUSED' } }),
        1
      );
      const audit = await StaffAuditService.history({ view: 'nutritionist', action: 'MEAL_APPROVAL_REUSED' });
      assert(audit.rows.some((row) => row.targetId === targetPlan.id && row.role === 'SYSTEM'));
      assert(!JSON.stringify(audit).includes('SYNTHETIC_PRIVATE'));
      const adminAudit = await StaffAuditService.history({ view: 'admin', action: 'MEAL_APPROVAL_REUSED' });
      assert(adminAudit.rows.some(row => row.targetId === targetPlan.id && row.role === 'SYSTEM'));
      if (index !== 4) {
        const recipeAudit = await StaffAuditService.history({ view: 'nutritionist', approvalActionsOnly: true,
          recipeCase: { libraryIds: [eligible.id], sourceId } });
        assert(recipeAudit.rows.some(row => row.targetId === targetPlan.id && row.actionCode === 'MEAL_APPROVAL_REUSED'));
      }
      if (index === 3) await db.mealLibrary.update({ where: { id: eligible.id }, data: { safetyReviewedByNutritionistId: certifier.id } });
      if (index === 0) {
        const { getManilaMidnight, getManilaDateKey } = await import('../src/domain/meal-plan-cycle.policy');
        const today = getManilaMidnight(getManilaDateKey(now));
        await db.mealPlanCycle.update({
          where: { id: targetPlan.planGroupId },
          data: { startDate: today, endDate: new Date(today.getTime() + 86400000), shoppingDeadlineAt: today },
        });
        await db.mealPlan.update({ where: { id: targetPlan.id }, data: { scheduledDate: today } });
        const memberView = await ok(request(targetActor, '/user/meals/current'));
        assert(JSON.stringify(memberView).includes(targetPlan.id));
        assert(!JSON.stringify(memberView).includes('SYNTHETIC_PRIVATE'));
        assert(!JSON.stringify(memberView).includes('exactApprovalReuse'));
        assert(!JSON.stringify(memberView).includes('referenceId'));
        await ok(request(targetActor, `/user/meals/${targetPlan.id}/status`, 'PATCH', { status: 'DONE' }));
        assert.equal((await db.mealLog.findUniqueOrThrow({ where: { mealPlanId: targetPlan.id } })).status, 'DONE');
        pass(
          'Member current API exposes the reused meal and original reviewer safely; only explicit DONE creates consumption'
        );
      }
      if (index === 1) {
        await db.mealLibrary.update({ where: { id: eligible.id }, data: { status: 'FLAGGED' } });
        assert(
          !(await MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId)).includes(
            targetPlan.id
          )
        );
        await db.mealLibrary.update({ where: { id: eligible.id }, data: { status: 'APPROVED' } });
        assert(
          !(await MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId)).includes(
            targetPlan.id
          )
        );
        pass('A base flag immediately blocks reuse; lifting the flag does not resurrect the invalidated slot');
      }
      if (index === 2) {
        await db.nutritionistProfile.update({ where: { id: reviewer.id }, data: { prcLicenseExpiry: new Date(0) } });
        assert(
          !(await MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId)).includes(
            targetPlan.id
          )
        );
        await db.nutritionistProfile.update({
          where: { id: reviewer.id },
          data: { prcLicenseExpiry: new Date('2099-01-01') },
        });
        pass('Expired original RND credentials block a reused approval');
      }
      await db.mealPlan.update({ where: { id: sourcePlan.id }, data: { status: 'DISPUTED' } });
      assert(
        !(await MealPlanCycleService.getClearedMealPlanIds(targetActor.id, targetPlan.planGroupId)).includes(
          targetPlan.id
        )
      );
      assert.equal((await db.mealPlan.findUniqueOrThrow({ where: { id: targetPlan.id } })).status, 'PENDING_REVIEW');
      pass(
        `${condition}${index === 0 ? ' plus nuts allergy and legacy reference' : ''}: exact reuse, concurrent retry, audit, no auto-consumption, dispute invalidation`
      );
    }
    const saved = await db.mealReviewReference.findFirstOrThrow();
    await db.mealReviewReference.delete({ where: { id: saved.id } });
    assert.equal((await preview()).reviewReferences.length, 0);
    pass('Legacy decisions without captured reference context are not reconstructed from current data');
    if (process.env.RND_BATCH5_BROWSER === 'true') {
      await db.mealReviewReference.create({
        data: { ...saved, plateFacts: saved.plateFacts as Prisma.InputJsonObject },
      });
      const liveMember = await cloneProfile();
      const liveMeal = await makeSlot(liveMember);
      await db.mealPlan.update({ where: { id: liveMeal.id }, data: { mealName: 'Live context plate' } });
      await ok(request(rnd, `/nutritionist/queue/${liveMeal.id}/release`, 'POST', {}));
      const decisionMeals: Record<string, string> = {};
      for (const action of ['approve', 'reject', 'swap']) {
        const actor = await cloneProfile();
        const plate = await makeSlot(actor);
        await db.mealPlan.update({ where: { id: plate.id }, data: { mealName: `Browser ${action} plate` } });
        await ok(request(rnd, `/nutritionist/queue/${plate.id}/release`, 'POST', {}));
        decisionMeals[action] = plate.id;
      }
      await library('Browser alternate measured recipe', 1);
      const outsideMember = await cloneProfile();
      const outsideName = 'Browser synthetic estimated snack';
      const outsidePreview = await db.outsideMealPreview.create({
        data: {
          userId: outsideMember.id,
          mealName: outsideName,
          mealType: 'SNACK',
          estimate: { calories: 410, proteinG: 5, carbsG: 66, fatG: 14 },
          warnings: ['Synthetic estimate for the local browser rehearsal.'],
          reasons: [],
          usedAi: true,
          expiresAt: new Date(Date.now() + 20 * 60_000),
          items: [
            {
              name: outsideName,
              portionGrams: null,
              source: 'GEMINI_ESTIMATED',
              nutritionStatus: 'PENDING_REVIEW',
              compatibilityStatus: 'REVIEW_REQUIRED',
              includedInTotals: true,
              calories: 410,
              proteinG: 5,
              carbsG: 66,
              fatG: 14,
              calorieLow: 330,
              calorieHigh: 490,
              foodItemId: null,
              mealLibraryId: null,
              ingredients: [],
              warnings: [],
            },
          ],
        },
      });
      await MealLogService.logOutsideMeal({
        userId: outsideMember.id,
        mealType: 'SNACK',
        warningAcknowledged: true,
        confirmationId: outsidePreview.id,
      });
      assert.equal(
        await db.outsideMealReview.count({ where: { outsideMealLogItem: { mealLog: { userId: outsideMember.id } } } }),
        0
      );
      const fixture = {
        apiOrigin: base.replace(/\/api$/, ''),
        memberId: second.id,
        mealId: fresh.id,
        liveMealId: liveMeal.id,
        decisionMeals,
        outsideName,
        actors: { member: second, rnd, successor: other, admin, liveMember, outsideMember },
      };
      const actors = Object.fromEntries(
        Object.entries(fixture.actors).map(([role, actor]) => [
          role,
          { userId: actor.id, token: signAccessToken({ userId: actor.id, email: actor.email, role: actor.role }) },
        ])
      );
      writeFileSync(resolve('.local/batch5-reference-browser.json'), JSON.stringify({ ...fixture, actors }));
      console.log('BROWSER_READY reference');
      await once(process, 'SIGINT');
      return;
    }
    console.log(
      JSON.stringify({
        target: 'task-owned loopback PostgreSQL',
        checks,
        accountsCreated: await db.user.count(),
        references:
          'private exact fingerprints; matching current cases automatically approved; consumption remains explicit',
      })
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
    globalThis.fetch = nativeFetch;
  }
}
if (require.main === module)
  runReviewReferenceAcceptance().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
