import InfoHint from '@/components/ui/InfoHint';

export default function MembershipBenefitInfo({ tier }: { tier: 'LIFESTYLE' | 'HEALTH' }) {
  return (
    <InfoHint label={`${tier === 'LIFESTYLE' ? 'Lifestyle' : 'Health'} planning details`}>
      {tier === 'LIFESTYLE' ? (
        <div className="space-y-2">
          <p className="font-bold">Everyday planning</p>
          <p>Weight, height, activity level, weight loss, maintenance or muscle gain, and dietary preferences.</p>
          <p className="text-brand-muted">
            Condition-specific planning and declared allergies currently require Health review.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-bold">Nutritionist-reviewed planning</p>
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
            Other conditions, allergies and restrictions can be submitted for assessment. Planning depends on
            nutritionist clearance.
          </p>
        </div>
      )}
    </InfoHint>
  );
}
