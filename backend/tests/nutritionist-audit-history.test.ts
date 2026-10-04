import assert from 'node:assert/strict';
import test from 'node:test';
import type prisma from '../src/lib/prisma';
import { NutritionistAuditService } from '../src/services/nutritionist-audit.service';
import { StaffAuditService } from '../src/services/staff-audit.service';

test('staff history binds search, pagination and dates rather than injecting them into SQL', async () => {
  const attack = "staff' OR true --";
  const db = {
    $queryRaw: async (query: { strings: string[]; values: unknown[] }) => {
      assert.ok(!query.strings.join('').includes(attack));
      assert.ok(query.values.includes(attack));
      assert.ok(query.values.includes(20));
      assert.ok(query.values.includes(40));
      assert.ok(
        query.values.some((value) => value instanceof Date && value.toISOString() === '2026-10-03T16:00:00.000Z')
      );
      return [{ total: 43n, rows: [] }];
    },
  } as unknown as typeof prisma;
  const result = await StaffAuditService.history({ view: 'admin', actor: attack, page: 3, from: '2026-10-04' }, db);
  assert.equal(result.totalPages, 3);
  assert.equal(result.page, 3);
});

test('nutritionist audit retains its existing presentation contract and includes administrator meal flags', async () => {
  const db = {
    $queryRaw: async (query: { strings: string[] }) => {
      assert.ok(query.strings.join('').includes("role = 'ADMIN' AND \"actionCode\" = 'MEAL_BASE_FLAGGED'"));
      return [
        {
          total: 1n,
          rows: [
            {
              id: 'review',
              occurredAt: '2026-10-04T12:00:00Z',
              actor: 'Former reviewer',
              role: 'NUTRITIONIST',
              actionCode: 'BASE_MEAL_VERIFIED',
              subject: 'Adobo',
            },
          ],
        },
      ];
    },
  } as unknown as typeof prisma;
  const result = await NutritionistAuditService.history(1, 20, db);
  assert.equal(result.rows[0].nutritionist, 'Former reviewer');
  assert.equal(result.rows[0].action, 'Verified a meal');
  assert.equal(result.total, 1);
});
