import InfoHint from '@/components/ui/InfoHint';

export default function MembershipBenefitInfo({ tier }: { tier: 'LIFESTYLE' | 'HEALTH' }) {
  return (
    <InfoHint label={`${tier === 'LIFESTYLE' ? 'Lifestyle' : 'Health'} planning details`}>
      {tier === 'LIFESTYLE' ? (
        <div className="space-y-2">
          <p className="font-bold">Everyday planning</p>
          <p>
            Activity level, weight loss, maintenance or muscle gain, and dietary preferences. Weight updates are
            included in Free.
          </p>
          <p className="text-brand-muted">
            Supported allergy changes: shellfish (including shrimp), peanuts and tree nuts, dairy, gluten and eggs. Only
            recipes with complete reviewed ingredient and allergen evidence qualify.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-bold">RND-reviewed planning</p>
          <p>
            <strong>Built-in condition categories:</strong> diabetes and hypertension.
          </p>
          <p>
            <strong>Built-in food restrictions:</strong> shellfish (including shrimp), peanuts and tree nuts, dairy,
            gluten and eggs.
          </p>
          <p>
            <strong>Individual assessment:</strong> kidney disease, heart conditions, pregnancy or breastfeeding, gout,
            celiac disease, PCOS and GERD.
          </p>
          <p className="text-brand-muted">
            Other conditions, allergies and restrictions can be submitted for assessment. Unknown ingredients are
            excluded; filtering cannot guarantee against cross-contact during cooking. Planning depends on RND
            clearance.
          </p>
        </div>
      )}
    </InfoHint>
  );
}
