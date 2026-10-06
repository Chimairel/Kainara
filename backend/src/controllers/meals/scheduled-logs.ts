import { isMealPlanNotActionableError } from '@/domain/meal-actionability.policy';

import { AppError } from '@/errors/AppError';
import prisma from '@/lib/prisma';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

import { updateScheduledMealStatus } from '@/services/scheduled-meal-log.service';

import { AuthenticatedRequest } from '@/types';

import { Response } from 'express';

/**
 * PATCH /api/user/meals/:id/status
 * Toggles the log status (DONE/SKIPPED) for a scheduled meal plan item.
 */
export async function updateMealStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const mealPlanId = req.params.id;
    const { status, notes } = req.body; // Expects 'DONE' | 'SKIPPED' | 'PENDING', optional notes

    if (!status || !['DONE', 'SKIPPED', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing status parameter.' });
    }

    const updatedLog = await updateScheduledMealStatus(userId, mealPlanId, status, notes);

    return res.status(200).json({
      success: true,
      data: updatedLog,
    });
  } catch (error: any) {
    console.error('[MealsController] updateMealStatus error:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
    }
    if (isMealPlanNotActionableError(error)) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to update scheduled meal status.',
    });
  }
}

/**
 * PATCH /api/user/meals/logs/:id/notes
 * Updates user notes on a logged meal (owned by the authenticated user).
 */
export async function updateMealLogNotes(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const logId = req.params.id;
    const { notes } = req.body;

    const log = await prisma.mealLog.findFirst({
      where: { id: logId, userId },
    });

    if (!log) {
      return res.status(404).json({ success: false, error: 'Meal log not found.' });
    }

    const updated = await prisma.mealLog.update({
      where: { id: logId },
      data: {
        notes: notes !== undefined ? notes : null,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        notes: updated.notes,
      },
    });
  } catch (error: any) {
    console.error('[MealsController] updateMealLogNotes error:', error);
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to update meal notes.'),
    });
  }
}
