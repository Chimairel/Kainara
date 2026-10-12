// Unit fixtures use the disabled rollout baseline. Local .env must not turn
// these fixtures into live clarification/profile database reads.
// Enabled behavior has dedicated HTTP/SQL acceptance against disposable data.
import process from 'node:process';
process.env.CLINICAL_CLARIFICATIONS_ENABLED = 'false';
// Unit tests use mocked persistence. Never inherit the normal-use hosted database.
process.env.DATABASE_URL = 'postgresql://unit_fixture:unit_fixture@127.0.0.1:1/unit_fixture';
process.env.DIRECT_URL = process.env.DATABASE_URL;
