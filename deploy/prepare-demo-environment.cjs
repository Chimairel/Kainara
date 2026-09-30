// Offline preparation only. Does not contact providers or change the local app environment.
const { randomBytes } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { parse } = require('../backend/node_modules/dotenv');

const root = path.resolve(__dirname, '..');
const railwayFile = path.join(__dirname, '.env.railway.local');
const vercelFile = path.join(__dirname, '.env.vercel.local');
if (existsSync(railwayFile) || existsSync(vercelFile)) {
  console.error(
    'Private deployment files already exist. Edit them directly; existing secrets will not be overwritten.'
  );
  process.exit(1);
}
const readEnvironment = (name) => (existsSync(name) ? parse(readFileSync(name)) : {});
const backend = readEnvironment(path.join(root, 'backend', '.env'));
const frontend = readEnvironment(path.join(root, 'frontend', '.env.local'));
const clientId = backend.GOOGLE_CLIENT_ID || frontend.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const railway = {
  NODE_ENV: 'production',
  NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo',
  // Never silently deploy against the owner's development database.
  DATABASE_URL: '',
  JWT_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  CRON_SECRET: randomBytes(32).toString('hex'),
  FRONTEND_URL: '',
  CORS_ORIGINS: '',
  // Initial single-proxy setting; verify actual forwarded client IP behavior after deployment.
  TRUST_PROXY: 'true',
  GOOGLE_CLIENT_ID: clientId,
  GEMINI_API_KEY: backend.GEMINI_API_KEY || '',
  GEMINI_PROJECT_MAX_RPM: backend.GEMINI_PROJECT_MAX_RPM || '2',
  GEMINI_PROJECT_MAX_RPD: backend.GEMINI_PROJECT_MAX_RPD || '40',
  GEMINI_PROJECT_MAX_ESTIMATED_TPM: backend.GEMINI_PROJECT_MAX_ESTIMATED_TPM || '50000',
  GEMINI_PROJECT_MAX_IN_FLIGHT: backend.GEMINI_PROJECT_MAX_IN_FLIGHT || '1',
  GEMINI_BACKGROUND_MAX_RPM: backend.GEMINI_BACKGROUND_MAX_RPM || '1',
  GEMINI_BACKGROUND_MAX_RPD: backend.GEMINI_BACKGROUND_MAX_RPD || '20',
  OUTSIDE_MEAL_AI_DAILY_CAP: backend.OUTSIDE_MEAL_AI_DAILY_CAP || '5',
  OUTSIDE_MEAL_AI_30_DAY_CAP: backend.OUTSIDE_MEAL_AI_30_DAY_CAP || '30',
  EMAIL_PROVIDER: 'brevo',
  BREVO_API_KEY: '',
  EMAIL_FROM: backend.EMAIL_FROM || backend.SMTP_USER || '',
  SMTP_VERIFY_ON_STARTUP: 'false',
  API_DOCS_ENABLED: 'false',
  CLOUDINARY_URL: backend.CLOUDINARY_URL || '',
  // Preserve the key if documents are included in a sanitized database copy.
  CLINICAL_DOCUMENT_ENCRYPTION_KEY: backend.CLINICAL_DOCUMENT_ENCRYPTION_KEY || randomBytes(32).toString('base64'),
};
const vercel = {
  NEXT_PUBLIC_API_URL: '/api',
  INTERNAL_API_URL: '',
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: clientId,
  NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo',
};
function serialize(values, note) {
  return [
    '# PRIVATE: contains credentials; never commit or share this file.',
    `# ${note}`,
    ...Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`),
    '',
  ].join('\n');
}
writeFileSync(
  railwayFile,
  serialize(railway, 'Fill DATABASE_URL, FRONTEND_URL, CORS_ORIGINS, BREVO_API_KEY; verify EMAIL_FROM in Brevo.'),
  { flag: 'wx', mode: 0o600 }
);
writeFileSync(vercelFile, serialize(vercel, 'Fill INTERNAL_API_URL with the Railway HTTPS origin, without /api.'), {
  flag: 'wx',
  mode: 0o600,
});
console.log('Prepared deploy/.env.railway.local and deploy/.env.vercel.local. No credentials printed or uploaded.');
console.log('Existing local app settings and database are unchanged. Fill the blank values before deployment.');
