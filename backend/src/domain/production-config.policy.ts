import { CLINICAL_NUTRITION_POLICY_VERSION } from './clinical-nutrition.policy';
import { isCapstoneDemo } from './deployment-mode.policy';

const PLACEHOLDER_PATTERN = /^(change|replace|example|your_|password|secret)/i;

export interface ProductionConfigIssue {
  key: string;
  reason: string;
}

export function validateProductionConfig(env: NodeJS.ProcessEnv): ProductionConfigIssue[] {
  const issues: ProductionConfigIssue[] = [];
  const mode = env.NUTRIMIND_DEPLOYMENT_MODE ?? 'public';
  if (!['public', 'capstone-demo'].includes(mode)) {
    issues.push({ key: 'NUTRIMIND_DEPLOYMENT_MODE', reason: 'must be public or capstone-demo' });
  }
  if (isCapstoneDemo(env)) {
    if (env.CLINICAL_POLICY_APPROVED_VERSION?.trim()) {
      issues.push({
        key: 'CLINICAL_POLICY_APPROVED_VERSION',
        reason: 'must be unset for the unapproved capstone demo',
      });
    }
  }
  if (env.NODE_ENV !== 'production') return issues;
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CRON_SECRET',
    'CORS_ORIGINS',
    ...(isCapstoneDemo(env) ? ['FRONTEND_URL'] : ['CLINICAL_POLICY_APPROVED_VERSION']),
  ];
  for (const key of required) {
    const value = env[key]?.trim();
    if (!value) issues.push({ key, reason: 'is required in production' });
    else if (PLACEHOLDER_PATTERN.test(value)) issues.push({ key, reason: 'still contains a placeholder value' });
  }
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRON_SECRET']) {
    const value = env[key]?.trim();
    if (value && value.length < 32) issues.push({ key, reason: 'must contain at least 32 characters' });
  }
  if (env.CORS_ORIGINS?.split(',').some((origin) => origin.trim() === '*')) {
    issues.push({ key: 'CORS_ORIGINS', reason: 'must not allow wildcard origins with credentials' });
  }
  if (isCapstoneDemo(env)) {
    for (const [key, urls] of [
      ['FRONTEND_URL', env.FRONTEND_URL],
      ['CORS_ORIGINS', env.CORS_ORIGINS],
    ] as const) {
      for (const value of urls?.split(',') ?? []) {
        try {
          const url = new URL(value.trim());
          if (url.protocol !== 'https:' || url.origin !== value.trim()) throw new Error('Invalid origin');
        } catch {
          issues.push({ key, reason: 'must contain exact HTTPS origins without paths' });
        }
      }
    }
  }
  if (
    env.CLINICAL_POLICY_APPROVED_VERSION &&
    env.CLINICAL_POLICY_APPROVED_VERSION !== CLINICAL_NUTRITION_POLICY_VERSION
  ) {
    issues.push({
      key: 'CLINICAL_POLICY_APPROVED_VERSION',
      reason: `must exactly match ${CLINICAL_NUTRITION_POLICY_VERSION}`,
    });
  }
  return issues;
}

export function assertProductionConfig(env: NodeJS.ProcessEnv): void {
  const issues = validateProductionConfig(env);
  if (issues.length > 0) {
    throw new Error(
      `Unsafe production configuration: ${issues.map((issue) => `${issue.key} ${issue.reason}`).join('; ')}`
    );
  }
}
