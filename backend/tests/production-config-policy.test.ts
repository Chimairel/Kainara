import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductionConfig } from '../src/domain/production-config.policy';

test('[TEST-062] development configuration is not subjected to production-only gates', () => {
  assert.deepEqual(validateProductionConfig({ NODE_ENV: 'development' }), []);
});

test('[TEST-063] production fails closed on absent, short, placeholder, or wildcard security configuration', () => {
  const issues = validateProductionConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'example-database',
    JWT_SECRET: 'short',
    JWT_REFRESH_SECRET: 'replace-me',
    CRON_SECRET: 'also-short',
    CORS_ORIGINS: '*',
  });
  assert.ok(issues.length >= 6);
  assert.ok(issues.some((issue) => issue.key === 'CORS_ORIGINS'));
  assert.ok(issues.some((issue) => issue.key === 'CLINICAL_POLICY_APPROVED_VERSION'));
});

test('[TEST-064] production accepts exact origins, strong secrets, and the signed policy version', () => {
  assert.deepEqual(
    validateProductionConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://service:strong-value@database.invalid/nutrimind',
      JWT_SECRET: 'a'.repeat(64),
      JWT_REFRESH_SECRET: 'b'.repeat(64),
      CRON_SECRET: 'c'.repeat(64),
      CORS_ORIGINS: 'https://nutrimind.example.invalid',
      CLINICAL_POLICY_APPROVED_VERSION: 'NUTRIMIND_CLINICAL_DRAFT_V1',
    }),
    []
  );
});

const secureDemo = {
  NODE_ENV: 'production',
  NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo',
  DATABASE_URL: 'postgresql://service:strong-value@database.invalid/demo',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  CRON_SECRET: 'c'.repeat(64),
  CORS_ORIGINS: 'https://demo.example.com',
  FRONTEND_URL: 'https://demo.example.com',
};

test('hosted capstone demo accepts unsigned policy without requiring an email allowlist', () => {
  assert.deepEqual(validateProductionConfig(secureDemo), []);
  assert.ok(
    validateProductionConfig({ ...secureDemo, CLINICAL_POLICY_APPROVED_VERSION: 'NUTRIMIND_CLINICAL_DRAFT_V1' }).some(
      (issue) => issue.key === 'CLINICAL_POLICY_APPROVED_VERSION'
    )
  );
});

test('hosted demo still requires secure credentials, HTTPS origins and a valid deployment mode', () => {
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRON_SECRET', 'DATABASE_URL']) {
    assert.ok(validateProductionConfig({ ...secureDemo, [key]: '' }).some((issue) => issue.key === key));
  }
  assert.ok(
    validateProductionConfig({ ...secureDemo, FRONTEND_URL: 'http://localhost:3000' }).some(
      (issue) => issue.key === 'FRONTEND_URL'
    )
  );
  assert.ok(
    validateProductionConfig({ ...secureDemo, CORS_ORIGINS: 'https://demo.example.com/path' }).some(
      (issue) => issue.key === 'CORS_ORIGINS'
    )
  );
  assert.ok(
    validateProductionConfig({ ...secureDemo, NUTRIMIND_DEPLOYMENT_MODE: 'demo' }).some(
      (issue) => issue.key === 'NUTRIMIND_DEPLOYMENT_MODE'
    )
  );
});

test('switching a demo to public restores the clinical approval requirement', () => {
  assert.ok(
    validateProductionConfig({ ...secureDemo, NUTRIMIND_DEPLOYMENT_MODE: 'public' }).some(
      (issue) => issue.key === 'CLINICAL_POLICY_APPROVED_VERSION'
    )
  );
});

test('Brevo production config requires a server key and a plain verified sender address', () => {
  for (const key of ['BREVO_API_KEY', 'EMAIL_FROM']) {
    assert.ok(validateProductionConfig({ ...secureDemo, EMAIL_PROVIDER: 'brevo' }).some((issue) => issue.key === key));
  }
  assert.deepEqual(
    validateProductionConfig({
      ...secureDemo,
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'test-only-key',
      EMAIL_FROM: 'sender@gmail.com',
    }),
    []
  );
  assert.ok(
    validateProductionConfig({
      ...secureDemo,
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'test-only-key',
      EMAIL_FROM: 'Name <sender@gmail.com>',
    }).some((issue) => issue.key === 'EMAIL_FROM')
  );
});
