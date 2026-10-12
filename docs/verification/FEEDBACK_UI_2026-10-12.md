# Shared feedback UI trace — October 12, 2026

## Outcome

Migrated **122 message locations across 101 source files** to the reusable FeedbackNotice component. Ordinary failures now use a soft tinted surface, a compact decorative icon and readable body text. Short query failures use its inline variant. Warning messages use a warm tint; existing clinical wording, review eligibility and required acknowledgments remain owned by their feature.

Login now presents **Couldn't sign in** followed by **Check your email and password, then try again.** for the existing invalid-credentials response. This changes presentation only; it does not disclose whether an account exists. Other backend errors retain their existing messages.

## Cause and boundaries

The global CSS selector matching border-status-error-text/ forces the full error color onto borders, overriding the intended low-opacity outline. Individually written containers also varied in font size, icon size, spacing and background. The shared notice avoids those outline classes; the global field-validation border rule is preserved.

The component supports error, warning, information and success tones, surface and inline presentation, an optional title and caller-provided recovery controls. Errors announce as alerts. Other tones announce as statuses; existing urgent warning alerts retain their explicit alert role. Decorative icons are hidden from assistive technology. Messages persist until the owning feature changes or the user invokes its existing dismissal action.

Input validation remains associated with the actual field through aria-invalid and aria-describedby. Authentication, requests, claim guards, retries, consent, grocery acknowledgment and database behavior are unchanged. No migrations, database writes or hosted deployment were performed.

### Deliberate exceptions

- Input and checkbox validation, photo-upload controls and individual field borders retain their component-specific treatment.
- Destructive account controls, status badges, incident records and severity-tagged clinical findings retain their distinct semantic presentation.
- The existing brown member announcements retain their approved compact disclosure component.
- Cooking links, analytic signal cards, eligibility panels and required acknowledgment checkboxes are functional surfaces rather than ordinary feedback messages.
- No native browser alert or confirm calls were found in frontend source.

## Verification

- Frontend suite: **207 files, 1,007 tests passed** after migration, including existing retry and review behavior.
- Additional tests for the final warning batch: **22 tests passed** across five relevant feature suites.
- Final targeted checks after the remaining admin and swap errors: **21 tests passed**, including shared feedback and meal-swap coverage. Final lint remained clean.
- Browser verification: **15 passed** across feedback, account access and onboarding; login failures at 1440px and 390px in both themes, retry submissions, retained inputs, field error association, reset recovery link and existing consent gates.
- Browser responses and Google controls were synthetic fixtures on loopback. These checks did not contact Neon, invoke providers or create accounts.
- Static comparison found no lost client directives in the changed TSX files. Request and state logic was reviewed through the diff; changes are presentation and the generic invalid-credentials copy above.
- Lint and architecture checks passed. Production build completed with exit 0; Windows reported the existing standalone node_modules symlink EPERM warning. That local packaging warning does not establish hosted deployment success.
- Desktop/mobile light and dark captures were inspected together. The new notice wraps without horizontal overflow.

## Source inventory

Counts include inline and rich recovery messages, not tests.

| Source | Locations |
| --- | ---: |
| [frontend/src/app/(admin)/admin/data/page.tsx](../../frontend/src/app/(admin)/admin/data/page.tsx) | 2 |
| [frontend/src/app/(admin)/admin/profile/page.tsx](../../frontend/src/app/(admin)/admin/profile/page.tsx) | 2 |
| [frontend/src/app/(admin)/admin/website/page.tsx](../../frontend/src/app/(admin)/admin/website/page.tsx) | 1 |
| [frontend/src/app/(auth)/forgot-password/page.tsx](../../frontend/src/app/(auth)/forgot-password/page.tsx) | 1 |
| [frontend/src/app/(auth)/reset-password/page.tsx](../../frontend/src/app/(auth)/reset-password/page.tsx) | 2 |
| [frontend/src/app/(auth)/verify-email/page.tsx](../../frontend/src/app/(auth)/verify-email/page.tsx) | 1 |
| [frontend/src/app/(nutritionist)/nutritionist/approved/NutritionistApprovedPanel.tsx](../../frontend/src/app/(nutritionist)/nutritionist/approved/NutritionistApprovedPanel.tsx) | 1 |
| [frontend/src/app/(nutritionist)/nutritionist/audit/page.tsx](../../frontend/src/app/(nutritionist)/nutritionist/audit/page.tsx) | 1 |
| [frontend/src/app/(nutritionist)/nutritionist/outside-meals/OutsideMealReviewsPanel.tsx](../../frontend/src/app/(nutritionist)/nutritionist/outside-meals/OutsideMealReviewsPanel.tsx) | 1 |
| [frontend/src/app/(nutritionist)/nutritionist/reviews/MealVerificationPanel.tsx](../../frontend/src/app/(nutritionist)/nutritionist/reviews/MealVerificationPanel.tsx) | 1 |
| [frontend/src/app/(nutritionist)/nutritionist/reviews/ProfileWorkPanel.tsx](../../frontend/src/app/(nutritionist)/nutritionist/reviews/ProfileWorkPanel.tsx) | 1 |
| [frontend/src/app/(onboarding)/onboarding/preferences/page.tsx](../../frontend/src/app/(onboarding)/onboarding/preferences/page.tsx) | 1 |
| [frontend/src/app/(onboarding)/onboarding/shopping-day/page.tsx](../../frontend/src/app/(onboarding)/onboarding/shopping-day/page.tsx) | 1 |
| [frontend/src/app/(onboarding)/onboarding/stats/page.tsx](../../frontend/src/app/(onboarding)/onboarding/stats/page.tsx) | 1 |
| [frontend/src/app/(onboarding)/onboarding/tos/page.tsx](../../frontend/src/app/(onboarding)/onboarding/tos/page.tsx) | 1 |
| [frontend/src/app/(user)/dashboard/[mealId]/page.tsx](../../frontend/src/app/(user)/dashboard/[mealId]/page.tsx) | 1 |
| [frontend/src/app/(user)/export/page.tsx](../../frontend/src/app/(user)/export/page.tsx) | 1 |
| [frontend/src/app/(user)/membership/checkout/page.tsx](../../frontend/src/app/(user)/membership/checkout/page.tsx) | 2 |
| [frontend/src/app/(user)/membership/page.tsx](../../frontend/src/app/(user)/membership/page.tsx) | 2 |
| [frontend/src/app/nutritionist-invitation/page.tsx](../../frontend/src/app/nutritionist-invitation/page.tsx) | 1 |
| [frontend/src/components/auth/AuthenticatedEntryRedirect.tsx](../../frontend/src/components/auth/AuthenticatedEntryRedirect.tsx) | 1 |
| [frontend/src/components/auth/AuthFormPrelude.tsx](../../frontend/src/components/auth/AuthFormPrelude.tsx) | 1 |
| [frontend/src/components/auth/GoogleSignInButton.tsx](../../frontend/src/components/auth/GoogleSignInButton.tsx) | 1 |
| [frontend/src/components/landing/LandingUploadGallery.tsx](../../frontend/src/components/landing/LandingUploadGallery.tsx) | 1 |
| [frontend/src/components/shared/AuditHistoryList.tsx](../../frontend/src/components/shared/AuditHistoryList.tsx) | 1 |
| [frontend/src/components/shared/MobileInstallPrompt.tsx](../../frontend/src/components/shared/MobileInstallPrompt.tsx) | 1 |
| [frontend/src/components/shared/RouteGuard.tsx](../../frontend/src/components/shared/RouteGuard.tsx) | 1 |
| [frontend/src/components/ui/pricing.tsx](../../frontend/src/components/ui/pricing.tsx) | 1 |
| [frontend/src/components/user/CheckinModal.tsx](../../frontend/src/components/user/CheckinModal.tsx) | 2 |
| [frontend/src/components/user/ProgressWorkspace.tsx](../../frontend/src/components/user/ProgressWorkspace.tsx) | 1 |
| [frontend/src/components/user/StructuredSafetyIntake.tsx](../../frontend/src/components/user/StructuredSafetyIntake.tsx) | 2 |
| [frontend/src/features/admin-analytics/AdminSafetyPanel.tsx](../../frontend/src/features/admin-analytics/AdminSafetyPanel.tsx) | 1 |
| [frontend/src/features/admin-analytics/AdminStatistics.tsx](../../frontend/src/features/admin-analytics/AdminStatistics.tsx) | 1 |
| [frontend/src/features/admin-audit/AdminAuditWorkspace.tsx](../../frontend/src/features/admin-audit/AdminAuditWorkspace.tsx) | 2 |
| [frontend/src/features/admin-audit/AdminSubscriptionHistory.tsx](../../frontend/src/features/admin-audit/AdminSubscriptionHistory.tsx) | 1 |
| [frontend/src/features/admin-audit/CaseReviewContext.tsx](../../frontend/src/features/admin-audit/CaseReviewContext.tsx) | 1 |
| [frontend/src/features/admin-audit/CaseReviewDocument.tsx](../../frontend/src/features/admin-audit/CaseReviewDocument.tsx) | 1 |
| [frontend/src/features/admin-data/CompositionEditor.tsx](../../frontend/src/features/admin-data/CompositionEditor.tsx) | 1 |
| [frontend/src/features/admin-data/FoodCatalogue.tsx](../../frontend/src/features/admin-data/FoodCatalogue.tsx) | 1 |
| [frontend/src/features/admin-meal-logs/AdminMealLogAudit.tsx](../../frontend/src/features/admin-meal-logs/AdminMealLogAudit.tsx) | 1 |
| [frontend/src/features/admin-meal-logs/AdminMealPopularity.tsx](../../frontend/src/features/admin-meal-logs/AdminMealPopularity.tsx) | 1 |
| [frontend/src/features/admin-meal-logs/MealLogDetail.tsx](../../frontend/src/features/admin-meal-logs/MealLogDetail.tsx) | 1 |
| [frontend/src/features/admin-meals/AdminMealAuthoring.tsx](../../frontend/src/features/admin-meals/AdminMealAuthoring.tsx) | 2 |
| [frontend/src/features/admin-meals/AdminMealBatch.tsx](../../frontend/src/features/admin-meals/AdminMealBatch.tsx) | 2 |
| [frontend/src/features/admin-nutritionists/AdminNutritionistsPanel.tsx](../../frontend/src/features/admin-nutritionists/AdminNutritionistsPanel.tsx) | 1 |
| [frontend/src/features/admin-nutritionists/ReviewRoutingPanel.tsx](../../frontend/src/features/admin-nutritionists/ReviewRoutingPanel.tsx) | 1 |
| [frontend/src/features/admin-people/AdminAccountsPanel.tsx](../../frontend/src/features/admin-people/AdminAccountsPanel.tsx) | 1 |
| [frontend/src/features/admin-people/TestAccountTool.tsx](../../frontend/src/features/admin-people/TestAccountTool.tsx) | 1 |
| [frontend/src/features/clinical-clarification/MemberClarifications.tsx](../../frontend/src/features/clinical-clarification/MemberClarifications.tsx) | 1 |
| [frontend/src/features/clinical-clarification/MemberProfileProposals.tsx](../../frontend/src/features/clinical-clarification/MemberProfileProposals.tsx) | 1 |
| [frontend/src/features/clinical-clarification/RndClarifications.tsx](../../frontend/src/features/clinical-clarification/RndClarifications.tsx) | 1 |
| [frontend/src/features/clinical-clarification/RndProfileProposals.tsx](../../frontend/src/features/clinical-clarification/RndProfileProposals.tsx) | 1 |
| [frontend/src/features/dashboard/DashboardWorkspace.tsx](../../frontend/src/features/dashboard/DashboardWorkspace.tsx) | 1 |
| [frontend/src/features/dashboard/OutsideMealPreview.tsx](../../frontend/src/features/dashboard/OutsideMealPreview.tsx) | 1 |
| [frontend/src/features/grocery/GroceryWorkspace.tsx](../../frontend/src/features/grocery/GroceryWorkspace.tsx) | 1 |
| [frontend/src/features/meal-card/MealCardModalBody.tsx](../../frontend/src/features/meal-card/MealCardModalBody.tsx) | 3 |
| [frontend/src/features/meal-reminders/DeviceNotificationsPanel.tsx](../../frontend/src/features/meal-reminders/DeviceNotificationsPanel.tsx) | 1 |
| [frontend/src/features/meal-reminders/MealReminderSettingsPanel.tsx](../../frontend/src/features/meal-reminders/MealReminderSettingsPanel.tsx) | 1 |
| [frontend/src/features/meals/MealLibraryPanel.tsx](../../frontend/src/features/meals/MealLibraryPanel.tsx) | 1 |
| [frontend/src/features/meals/MealsHistorySection.tsx](../../frontend/src/features/meals/MealsHistorySection.tsx) | 1 |
| [frontend/src/features/meals/MealsWorkspace.tsx](../../frontend/src/features/meals/MealsWorkspace.tsx) | 1 |
| [frontend/src/features/meals/MealsWorkspaceModals.tsx](../../frontend/src/features/meals/MealsWorkspaceModals.tsx) | 2 |
| [frontend/src/features/meals/swap/SwapMealOptions.tsx](../../frontend/src/features/meals/swap/SwapMealOptions.tsx) | 1 |
| [frontend/src/features/membership/MembershipGate.tsx](../../frontend/src/features/membership/MembershipGate.tsx) | 1 |
| [frontend/src/features/membership/MembershipTimeline.tsx](../../frontend/src/features/membership/MembershipTimeline.tsx) | 1 |
| [frontend/src/features/membership/SubscriptionHistoryCard.tsx](../../frontend/src/features/membership/SubscriptionHistoryCard.tsx) | 1 |
| [frontend/src/features/nutritionist-application/ApplicantEmailVerification.tsx](../../frontend/src/features/nutritionist-application/ApplicantEmailVerification.tsx) | 1 |
| [frontend/src/features/nutritionist-application/ApplicationStatusCard.tsx](../../frontend/src/features/nutritionist-application/ApplicationStatusCard.tsx) | 1 |
| [frontend/src/features/nutritionist-application/ApplicationTrackingForm.tsx](../../frontend/src/features/nutritionist-application/ApplicationTrackingForm.tsx) | 1 |
| [frontend/src/features/nutritionist-application/ApplicationWizard.tsx](../../frontend/src/features/nutritionist-application/ApplicationWizard.tsx) | 1 |
| [frontend/src/features/nutritionist-application/PhotoUpload.tsx](../../frontend/src/features/nutritionist-application/PhotoUpload.tsx) | 1 |
| [frontend/src/features/nutritionist-application/steps/IdentityFields.tsx](../../frontend/src/features/nutritionist-application/steps/IdentityFields.tsx) | 1 |
| [frontend/src/features/nutritionist-library/LibrarySafetyReview.tsx](../../frontend/src/features/nutritionist-library/LibrarySafetyReview.tsx) | 1 |
| [frontend/src/features/nutritionist-library/MealApprovalsPanel.tsx](../../frontend/src/features/nutritionist-library/MealApprovalsPanel.tsx) | 2 |
| [frontend/src/features/nutritionist-library/MealReviewPanel.tsx](../../frontend/src/features/nutritionist-library/MealReviewPanel.tsx) | 1 |
| [frontend/src/features/nutritionist-library/MealReviewQueue.tsx](../../frontend/src/features/nutritionist-library/MealReviewQueue.tsx) | 1 |
| [frontend/src/features/nutritionist-library/MealReviewTimeline.tsx](../../frontend/src/features/nutritionist-library/MealReviewTimeline.tsx) | 1 |
| [frontend/src/features/nutritionist-library/PrepareLibraryNutritionEvidence.tsx](../../frontend/src/features/nutritionist-library/PrepareLibraryNutritionEvidence.tsx) | 1 |
| [frontend/src/features/nutritionist-library/RecipeDerivationForm.tsx](../../frontend/src/features/nutritionist-library/RecipeDerivationForm.tsx) | 1 |
| [frontend/src/features/nutritionist-library/SharedMealLibraryWorkspace.tsx](../../frontend/src/features/nutritionist-library/SharedMealLibraryWorkspace.tsx) | 1 |
| [frontend/src/features/nutritionist-license/AdminLicenseUpdates.tsx](../../frontend/src/features/nutritionist-license/AdminLicenseUpdates.tsx) | 3 |
| [frontend/src/features/nutritionist-license/RndLicenseUpdates.tsx](../../frontend/src/features/nutritionist-license/RndLicenseUpdates.tsx) | 2 |
| [frontend/src/features/nutritionist-profile/NutritionistAccountSection.tsx](../../frontend/src/features/nutritionist-profile/NutritionistAccountSection.tsx) | 1 |
| [frontend/src/features/nutritionist-profile/useNutritionistProfilePageModel.tsx](../../frontend/src/features/nutritionist-profile/useNutritionistProfilePageModel.tsx) | 1 |
| [frontend/src/features/nutritionist-reviews/CaseReviewDocument.tsx](../../frontend/src/features/nutritionist-reviews/CaseReviewDocument.tsx) | 3 |
| [frontend/src/features/nutritionist-reviews/CaseReviewQueue.tsx](../../frontend/src/features/nutritionist-reviews/CaseReviewQueue.tsx) | 1 |
| [frontend/src/features/nutritionist-reviews/CaseReviewWorkspace.tsx](../../frontend/src/features/nutritionist-reviews/CaseReviewWorkspace.tsx) | 1 |
| [frontend/src/features/nutritionist-reviews/MealVerificationQueue.tsx](../../frontend/src/features/nutritionist-reviews/MealVerificationQueue.tsx) | 1 |
| [frontend/src/features/nutritionist-reviews/ReviewDecisionDialog.tsx](../../frontend/src/features/nutritionist-reviews/ReviewDecisionDialog.tsx) | 1 |
| [frontend/src/features/nutritionist-reviews/ReviewNutrientFilters.tsx](../../frontend/src/features/nutritionist-reviews/ReviewNutrientFilters.tsx) | 1 |
| [frontend/src/features/onboarding/OnboardingSafetyStep.tsx](../../frontend/src/features/onboarding/OnboardingSafetyStep.tsx) | 1 |
| [frontend/src/features/profile/account/AccountIdentitySection.tsx](../../frontend/src/features/profile/account/AccountIdentitySection.tsx) | 1 |
| [frontend/src/features/profile/account/AccountPrivacySection.tsx](../../frontend/src/features/profile/account/AccountPrivacySection.tsx) | 1 |
| [frontend/src/features/profile/account/AccountSecuritySection.tsx](../../frontend/src/features/profile/account/AccountSecuritySection.tsx) | 1 |
| [frontend/src/features/profile/AvatarSettings.tsx](../../frontend/src/features/profile/AvatarSettings.tsx) | 1 |
| [frontend/src/features/profile/ClinicalEvidenceWorkspace.tsx](../../frontend/src/features/profile/ClinicalEvidenceWorkspace.tsx) | 1 |
| [frontend/src/features/progress/sections/ProgressOverviewSection.tsx](../../frontend/src/features/progress/sections/ProgressOverviewSection.tsx) | 1 |
| [frontend/src/features/progress/sections/ProgressProfileSection.tsx](../../frontend/src/features/progress/sections/ProgressProfileSection.tsx) | 1 |
| [frontend/src/features/reports/NutritionGuidanceDocument.tsx](../../frontend/src/features/reports/NutritionGuidanceDocument.tsx) | 1 |
| [frontend/src/features/reports/NutritionReportWorkspace.tsx](../../frontend/src/features/reports/NutritionReportWorkspace.tsx) | 3 |
| [frontend/src/features/reports/ReportsWorkspace.tsx](../../frontend/src/features/reports/ReportsWorkspace.tsx) | 1 |

## Future use

Use components/shared/FeedbackNotice for standalone errors and warnings. Keep validation, action handlers and factual copy in the caller. Use variant="inline" for a short failure in a toolbar or queue; use the surface variant when the user needs recovery context. Pass a title only when it adds a useful hierarchy. Do not introduce a second alert wrapper around the notice or add another warning icon inside it.
