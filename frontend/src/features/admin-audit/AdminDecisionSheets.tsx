import { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import RecordedCaseFields, { recordedObject, recordValue } from './RecordedCaseFields';
import RecordedEvidenceDetails from './RecordedEvidenceDetails';

const footer = 'Read-only case oversight · Access to clinical details is recorded';

function ProfileRecord({
  profile,
  context,
  evidence,
}: {
  profile: unknown;
  context: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
}) {
  const fields = recordedObject(profile);
  const clinical = recordedObject(context?.clinical);
  const summaryKeys = new Set([
    'age',
    'biologicalSex',
    'heightCm',
    'weightKg',
    'targetWeightKg',
    'goal',
    'activityLevel',
    'dietaryPreference',
    'dailyCalorieTarget',
    'ricePreference',
    'revision',
    'safetyRevision',
    'conditions',
    'allergens',
    'safetyScope',
  ]);
  const summary = fields ? Object.fromEntries(Object.entries(fields).filter(([key]) => summaryKeys.has(key))) : profile;
  const clinicalSummary = clinical
    ? Object.fromEntries(
        Object.entries(clinical).filter(([key]) =>
          ['conditions', 'allergies', 'customConditions', 'customFoodRestrictions', 'healthDetails'].includes(key)
        )
      )
    : evidence?.healthDetails;
  return (
    <>
      <RecordedCaseFields value={summary} paper />
      {clinicalSummary != null && (
        <section className="space-y-3">
          <h3 className="text-lg font-bold">Recorded health context</h3>
          <RecordedCaseFields value={clinicalSummary} paper />
        </section>
      )}
      <RecordedEvidenceDetails
        label="All recorded profile and guidance details"
        value={{
          profile,
          ...(context
            ? { clinical: context.clinical, safetyEntries: context.safetyEntries, guidance: context.guidance }
            : { healthDetails: evidence?.healthDetails }),
        }}
      />
    </>
  );
}

function MealRecord({ title, value }: { title: string; value: unknown }) {
  const object = recordedObject(value);
  const { ingredients, ...fields } = object ?? {};
  return (
    <section className="space-y-4">
      <h3 className="border-b border-brand-border pb-2 text-lg font-bold">{title}</h3>
      <RecordedCaseFields value={object ? fields : null} paper />
      {Array.isArray(ingredients) && (
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="mb-2 text-left font-bold">Recorded ingredients</caption>
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th className="w-1/2 p-2">Ingredient</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Unit</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((value, index) => {
              const ingredient = recordedObject(value);
              return (
                <tr key={index} className="border-b border-brand-border">
                  <td className="p-2">
                    {recordValue(
                      ingredient?.name ?? ingredient?.ingredientName ?? (typeof value === 'string' ? value : null)
                    )}
                  </td>
                  <td className="p-2">{recordValue(ingredient?.quantity)}</td>
                  <td className="p-2">{recordValue(ingredient?.unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Only persisted decision evidence is projected; the current member/recipe is never a fallback. */
export default function AdminDecisionSheets({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: unknown;
  subtitle: string;
}) {
  const decision = recordedObject(value);
  const evidence = recordedObject(decision?.evidenceSnapshot);
  const context = recordedObject(evidence?.reviewContext);
  const profile = context?.profile ?? evidence?.recordedProfile;
  const meal = context?.meal;
  const decisionFields = Object.fromEntries(
    Object.entries(decision ?? {}).filter(([key]) => key !== 'evidenceSnapshot')
  );
  const hasMeal =
    evidence && (evidence.original != null || evidence.effective != null || meal != null || evidence.mealName != null);
  const mealFields = evidence && {
    mealName: evidence.mealName,
    calories: evidence.calories,
    proteinG: evidence.proteinG,
    carbsG: evidence.carbsG,
    fatG: evidence.fatG,
    servingComponents: evidence.servingComponents,
  };
  const pages = [
    <ReviewDocumentPage
      key="decision"
      page={1}
      title={title}
      subtitle={subtitle}
      recordLabel="Admin oversight"
      footer={footer}
    >
      <RecordedCaseFields value={decisionFields} paper />
      {!hasMeal && profile == null && <RecordedCaseFields value={evidence} paper />}
      {hasMeal && (
        <RecordedCaseFields
          paper
          value={{
            reviewedBy: evidence.reviewedBy,
            policyVersion: evidence.policyVersion,
            clinicalDocuments: evidence.clinicalDocuments,
            replacementOutcome: evidence.replacementOutcome,
          }}
        />
      )}
      {evidence && (hasMeal || profile != null) && (
        <RecordedEvidenceDetails label="Complete evidence recorded with this decision" value={evidence} />
      )}
    </ReviewDocumentPage>,
  ];
  if (profile != null || hasMeal)
    pages.push(
      <ReviewDocumentPage
        key="profile"
        page={pages.length + 1}
        title="Recorded member context"
        subtitle="Member context saved with this decision. Current profile changes do not alter this record."
        recordLabel="Admin oversight"
        footer={footer}
      >
        {profile != null ? (
          <ProfileRecord profile={profile} context={context} evidence={evidence} />
        ) : (
          <p className="text-sm text-brand-muted">
            No member profile snapshot was recorded for this decision. Current details are available separately.
          </p>
        )}
      </ReviewDocumentPage>
    );
  if (hasMeal)
    pages.push(
      <ReviewDocumentPage
        key="meal"
        page={pages.length + 1}
        title="Recorded meal evidence"
        subtitle="Original and effective values saved by this RND. Ingredients are read-only."
        recordLabel="Admin oversight"
        footer={footer}
      >
        {evidence.original != null || evidence.effective != null ? (
          <>
            <MealRecord title="Original recorded meal" value={evidence.original} />
            <MealRecord title="Effective verified meal" value={evidence.effective} />
          </>
        ) : (
          <MealRecord title="Meal recorded for review" value={meal ?? mealFields} />
        )}
        <RecordedCaseFields
          value={{ servingComponents: evidence.servingComponents ?? recordedObject(meal)?.servingComponents ?? null }}
          paper
        />
      </ReviewDocumentPage>
    );
  return pages;
}
