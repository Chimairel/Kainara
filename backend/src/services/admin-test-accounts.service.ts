import { randomBytes } from 'node:crypto';
import prisma from '@/lib/prisma';
import {
  accountSpecs,
  adminTestAccountTarget,
  signAccountPreview,
  verifyAccountPreview,
  type TestAccountRequest,
} from './dev-test-accounts/admin-policy';
import { createAccounts, inspectAccounts } from './dev-test-accounts/writer';
import { AllergenType, HealthConditionType } from '@prisma/client';

export const AdminTestAccountsService = {
  capabilities() {
    try {
      const target = adminTestAccountTarget(process.env);
      return {
        available: true,
        target: target.label,
        conditions: Object.values(HealthConditionType),
        allergens: Object.values(AllergenType),
      };
    } catch {
      return { available: false };
    }
  },
  async preview(actorId: string, request: TestAccountRequest) {
    const target = adminTestAccountTarget(process.env);
    const accounts = await inspectAccounts(prisma, request.set, accountSpecs(request));
    return {
      target: target.label,
      accounts,
      previewToken: signAccountPreview(actorId, target.token, request, process.env.JWT_SECRET ?? ''),
    };
  },
  async create(actorId: string, request: TestAccountRequest, previewToken: string) {
    const target = adminTestAccountTarget(process.env);
    verifyAccountPreview(previewToken, actorId, target.token, request, process.env.JWT_SECRET ?? '');
    const password = randomBytes(24).toString('base64url');
    const accounts = await createAccounts(prisma, request.set, accountSpecs(request), password, actorId);
    return { accounts, newAccountPassword: accounts.some((item) => !item.exists) ? password : null };
  },
};
