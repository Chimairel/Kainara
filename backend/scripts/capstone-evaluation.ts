/** Read-only, aggregate software evaluation. Does not export member identities or clinical content. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import prisma from '../src/lib/prisma';
import { distribution, percentage } from './helpers/capstone-statistics';

async function main() {
  const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const from = new Date(arg('from') ?? new Date(Date.now() - 7 * 86400000).toISOString());
  const to = new Date(arg('to') ?? new Date().toISOString());
  assert(
    Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && from < to,
    'Specify a valid --from/--to interval.'
  );
  const prefix = arg('email-prefix');
  const user = prefix ? { email: { startsWith: prefix } } : {};
  const window = { gte: from, lt: to };
  const [jobs, decisions, plates, referenceCount] = await Promise.all([
    prisma.mealPlanGenerationJob.findMany({
      where: { user, createdAt: window },
      select: { status: true, startedAt: true, completedAt: true, lastErrorCode: true },
    }),
    prisma.mealPlanReviewDecision.findMany({
      where: { mealPlan: { user }, submittedAt: window },
      select: { decision: true, submittedAt: true, mealPlan: { select: { createdAt: true } } },
    }),
    prisma.mealPlan.groupBy({
      by: ['candidateProvenance', 'status'],
      where: { user, createdAt: window },
      _count: { _all: true },
    }),
    prisma.mealReviewReference.count({ where: { decision: { mealPlan: { user } }, createdAt: window } }),
  ]);
  const completed = jobs.filter((job) => job.status === 'COMPLETED');
  const timedCompletions = completed.filter((job) => job.completedAt);
  const approved = decisions.filter((decision) => decision.decision === 'APPROVE').length;
  const report = {
    measuredAt: new Date().toISOString(),
    from: from.toISOString(),
    to: to.toISOString(),
    scope: prefix ? 'Explicit account email prefix; aggregate only' : 'All accounts; aggregate only',
    generation: {
      jobs: jobs.length,
      completed: completed.length,
      completionPct: percentage(completed.length, jobs.length),
      missingCompletionTime: completed.length - timedCompletions.length,
      elapsed: distribution(timedCompletions.map((job) => job.completedAt!.getTime() - job.startedAt.getTime())),
      unfinished: jobs.reduce<Record<string, number>>((result, job) => {
        if (job.status !== 'COMPLETED') result[job.status] = (result[job.status] ?? 0) + 1;
        return result;
      }, {}),
    },
    review: {
      decisions: decisions.length,
      approved,
      rejected: decisions.length - approved,
      rejectionPct: percentage(decisions.length - approved, decisions.length),
      elapsedSinceCandidateCreation: distribution(
        decisions.map((decision) => decision.submittedAt.getTime() - decision.mealPlan.createdAt.getTime())
      ),
      exactContextReferenceRecords: referenceCount,
    },
    plates: plates.map((group) => ({
      provenance: group.candidateProvenance,
      status: group.status,
      count: group._count._all,
    })),
    limits: [
      'Generation elapsed includes queued waiting, interruptions and retries; incomplete jobs are reported separately.',
      'Review elapsed is time since candidate creation, including waiting; it is not active RND working time.',
      'Decisions include repeat/staged reviews; rejection percentage describes decisions, not unique meals.',
      'Exact-context reference records are reusable evidence produced, not views or automatic approval reuse.',
      'This report does not establish clinical accuracy; synthetic accounts do not measure real-user outcomes.',
    ],
  };
  const directory = resolve('.local/capstone-evaluation');
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, `evaluation-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ file, ...report }, null, 2));
}
main()
  .finally(() => prisma.$disconnect())
  .catch(() => {
    console.error('Evaluation failed; check the configured database and interval.');
    process.exitCode = 1;
  });
