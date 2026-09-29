import type { Prisma } from '@prisma/client';

export function sourceDataAuditLabel(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const audit = value.dataCompletionAudit;
  if (!audit || typeof audit !== 'object' || Array.isArray(audit) ||
      audit.version !== 'CODEX_PANLASANG_DATA_AUDIT_V1') return null;
  const operations = Array.isArray(audit.operations) ? audit.operations : [];
  if (operations.includes('CODEX_SIMILAR_RECIPE_ESTIMATE_V1')) {
    return 'Codex demo nutrition estimate · review before publishing';
  }
  return operations.includes('MISSING_SOURCE_NUTRITION_RECORDED_AS_NULL')
    ? 'Codex data audit · source nutrition unavailable'
    : 'Codex data audit · source quantities recovered';
}
