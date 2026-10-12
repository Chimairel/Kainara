import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';

const select = {
  id: true,
  name: true,
  source: true,
  calories: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
} as const;

/** Keep exact identities visible when a broad mixed-source search has many matches. */
export async function searchRecipeFoods(search: string, db: Pick<PrismaClient, 'foodItem'> = prisma) {
  const term = search.trim().slice(0, 100);
  if (term.length < 2) return [];
  const source = { in: ['FNRI', 'USDA_FDC'] };
  const exact = await db.foodItem.findMany({
    where: { source, name: { equals: term, mode: 'insensitive' } },
    select,
    take: 20,
    orderBy: [{ source: 'asc' }, { id: 'asc' }],
  });
  if (exact.length === 20) return exact;
  const related = await db.foodItem.findMany({
    where: { source, name: { contains: term, mode: 'insensitive' }, id: { notIn: exact.map((food) => food.id) } },
    select,
    take: 20 - exact.length,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return [...exact, ...related];
}
