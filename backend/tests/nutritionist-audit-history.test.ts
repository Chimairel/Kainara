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

test('audit JSON timestamps retain their UTC instant across server and client time zones', async () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timeZone of ['Asia/Manila', 'America/Los_Angeles', 'UTC']) {
      process.env.TZ = timeZone;
      const timestamps = ['2026-10-10T00:14:00.123', '2026-10-10T00:14:00.123Z', '2026-10-10T08:14:00.123+08:00'];
      const db = {
        $queryRaw: async () => [
          {
            total: 3n,
            rows: timestamps.map((occurredAt, index) => ({
              id: `review-${index}`,
              occurredAt,
              actor: 'Test reviewer',
              role: 'NUTRITIONIST',
              actionCode: 'MEAL_PLAN_APPROVED',
              subject: 'Meal plan case',
            })),
          },
        ],
      } as unknown as typeof prisma;
      const result = await StaffAuditService.history({ view: 'nutritionist' }, db);
      for (const row of result.rows) {
        assert.equal(new Date(row.occurredAt).toISOString(), '2026-10-10T00:14:00.123Z', timeZone);
        assert.equal(
          new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(row.occurredAt)),
          'Oct 10, 2026, 8:14 AM',
          timeZone
        );
      }
      assert.equal(result.rows[1].occurredAt, timestamps[1]);
      assert.equal(result.rows[2].occurredAt, timestamps[2]);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
