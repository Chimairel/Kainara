-- Feedback completes a request without certifying or changing its nutrition estimate.
ALTER TYPE "OutsideMealReviewStatus" ADD VALUE IF NOT EXISTS 'FEEDBACK_SENT';
