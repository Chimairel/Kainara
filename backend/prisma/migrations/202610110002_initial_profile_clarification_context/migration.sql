-- UserProfile.revision defaults to 0. First-profile questions and corrections
-- must use that exact context, rather than changing the member's revision.
BEGIN;

ALTER TABLE "ClinicalClarificationForm"
  DROP CONSTRAINT "ClinicalClarificationForm_positive_revision",
  ADD CONSTRAINT "ClinicalClarificationForm_nonnegative_revision"
    CHECK ("profileRevision" >= 0);

ALTER TABLE "ClinicalProfileProposal"
  DROP CONSTRAINT "ClinicalProfileProposal_revision_check",
  ADD CONSTRAINT "ClinicalProfileProposal_revision_check"
    CHECK ("profileRevision" >= 0);

COMMIT;
