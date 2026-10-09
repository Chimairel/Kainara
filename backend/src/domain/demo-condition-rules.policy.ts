/** These are proposals for RND review, not enabled clinical policies. */
export const DEMO_RULESET_VERSION = 'DEMO_NUTRIENT_SCREENING_DRAFT_V1';
export const DEMO_RULE_SOURCES = [
  {
    code: 'DEMO_WHO_SODIUM_2025',
    title: 'Sodium reduction',
    issuingOrganization: 'World Health Organization',
    canonicalUrl: 'https://www.who.int/news-room/fact-sheets/detail/sodium-reduction',
    sourceVersion: 'Retrieved 2026-10-09',
    domain: 'HYPERTENSION' as const,
    locator: 'WHO recommendations — adults: less than 2000 mg/day sodium',
    population: 'Adults; population-level sodium reduction guidance, subject to individual clinical review.',
  },
  {
    code: 'DEMO_AHA_SATURATED_FAT_2026',
    title: 'Saturated Fats',
    issuingOrganization: 'American Heart Association',
    canonicalUrl: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats',
    sourceVersion: 'Retrieved 2026-10-09',
    domain: 'CARDIOVASCULAR' as const,
    locator: 'AHA recommendation: dietary pattern achieving less than 6% of calories from saturated fat',
    population:
      'Adults following a cholesterol-lowering dietary pattern; broad HEART_CONDITION labels need diagnosis-specific review.',
  },
];
export const DEMO_RULE_PROPOSALS = [
  {
    condition: 'HYPERTENSION' as const,
    nutrient: 'SODIUM_MG' as const,
    threshold: 2000,
    unit: 'mg',
    basis: 'DAILY_TOTAL' as const,
    sourceCode: DEMO_RULE_SOURCES[0].code,
  },
  {
    condition: 'HEART_CONDITION' as const,
    nutrient: 'SODIUM_MG' as const,
    threshold: 2000,
    unit: 'mg',
    basis: 'DAILY_TOTAL' as const,
    sourceCode: DEMO_RULE_SOURCES[0].code,
  },
  {
    condition: 'HEART_CONDITION' as const,
    nutrient: 'SATURATED_FAT_G' as const,
    threshold: 6,
    unit: '%',
    basis: 'PERCENT_OF_DAILY_CALORIES' as const,
    sourceCode: DEMO_RULE_SOURCES[1].code,
  },
];
export const DEMO_RULE_CAVEATS =
  'Draft screening proposal only. Complete daily meal and outside-food totals are required; do not apply a daily limit independently to each meal. Demo assumptions are not verified measurements. Individual diagnosis, prescribed restrictions, medications, pregnancy and renal context require RND review. Passing these criteria does not establish suitability or grant clearance.';
