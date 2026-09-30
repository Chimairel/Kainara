import { Router } from 'express';
import { body } from 'express-validator';
import AuthController from '@/controllers/auth.controller';
import validate from '@/middleware/validate';
import authenticate from '@/middleware/auth';
import {
  accountCreationLimiter,
  loginLimiter,
  passwordRecoveryLimiter,
  sessionLimiter,
  verificationAttemptLimiter,
  verificationResendLimiter,
} from '@/middleware/rateLimiter';

const router = Router();

// Separate budgets keep onboarding and routine session traffic from exhausting sign-in attempts.

/**
 * Route: POST /api/auth/register
 * Description: Registers a new user with email verification OTP.
 */
router.post(
  '/register',
  accountCreationLimiter,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required.')
      .isLength({ max: 161 })
      .withMessage('Name is too long.')
      .matches(/[\p{L}]/u)
      .withMessage('Name must contain at least one letter.')
      .matches(/^[\p{L}\p{M}'’ .-]+$/u)
      .withMessage('Name contains unsupported characters.'),
    body('email')
      .trim()
      .isLength({ max: 254 })
      .withMessage('Email address is too long.')
      .isEmail()
      .withMessage('Please provide a valid email address.'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters long.')
      .matches(/\S/)
      .withMessage('Password cannot consist only of spaces.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/^[^\u0000-\u001F\u007F]+$/u)
      .withMessage('Password cannot contain control characters.'),
    validate,
  ],
  AuthController.register
);

/**
 * Route: POST /api/auth/login
 * Description: Logs in an existing user.
 */
router.post(
  '/login',
  loginLimiter,
  [
    body('email').trim().isEmail().withMessage('Please provide a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.'),
    validate,
  ],
  AuthController.login
);

const googleCredentialValidation = [
  body('idToken').isString().isLength({ min: 20, max: 8192 }).withMessage('A valid Google credential is required.'),
  validate,
];

/** Unified continuation verifies identity before applying the new-account creation budget. */
router.post('/google/continue', loginLimiter, googleCredentialValidation, AuthController.googleContinue);

/** Existing-account Google sign-in. Never creates a missing account. */
router.post('/google/login', loginLimiter, googleCredentialValidation, AuthController.googleLogin);

/** Explicit Google account creation. Verified Google email skips OTP. */
router.post('/google/register', accountCreationLimiter, googleCredentialValidation, AuthController.googleRegister);

/** Backwards-compatible alias with safe login-only behavior. */
router.post('/google', loginLimiter, googleCredentialValidation, AuthController.googleLogin);

/**
 * Route: POST /api/auth/verify-email
 * Description: Verifies user's email with 6-digit OTP. Requires auth token.
 */
router.post(
  '/verify-email',
  verificationAttemptLimiter,
  authenticate,
  [
    body('otp')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Verification code must be exactly 6 digits.')
      .isNumeric()
      .withMessage('Verification code must contain only numbers.'),
    validate,
  ],
  AuthController.verifyEmail
);

/**
 * Route: POST /api/auth/resend-verification
 * Description: Resends a new OTP to the user's email. Requires auth token.
 */
router.post('/resend-verification', verificationResendLimiter, authenticate, AuthController.resendVerification);

/**
 * Route: POST /api/auth/forgot-password
 * Description: Sends password reset email. Public endpoint.
 */
router.post(
  '/forgot-password',
  passwordRecoveryLimiter,
  [body('email').trim().isEmail().withMessage('Please provide a valid email address.'), validate],
  AuthController.forgotPassword
);

/**
 * Route: POST /api/auth/reset-password
 * Description: Resets password with a valid token. Public endpoint.
 */
router.post(
  '/reset-password',
  passwordRecoveryLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters long.')
      .matches(/\S/)
      .withMessage('Password cannot consist only of spaces.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/^[^\u0000-\u001F\u007F]+$/u)
      .withMessage('Password cannot contain control characters.'),
    validate,
  ],
  AuthController.resetPassword
);

/**
 * Route: POST /api/auth/refresh
 * Description: Refreshes an expired access token using a valid refresh token.
 */
router.post('/refresh', sessionLimiter, AuthController.refresh);

/**
 * Route: POST /api/auth/logout
 * Description: Revokes the refresh session and clears its cookie, even after access expiry.
 */
router.post('/logout', sessionLimiter, AuthController.logout);

export default router;
