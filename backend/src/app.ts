import liveRouter from '@/routes/live.routes';
import { liveMutationUpdates } from '@/middleware/liveUpdates';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createCorsOptions } from '@/config/cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiLimiter } from '@/middleware/rateLimiter';
import { verifyEmailTransporter } from '@/lib/email';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { env } from '@/config/env';
import { CAPSTONE_DEMO_NOTICE, isCapstoneDemo } from '@/domain/deployment-mode.policy';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { logger } from '@/lib/logger';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '@/docs/openapi';

// Import Routers
import authRouter from '@/routes/auth.routes';
import userRouter from '@/routes/user.routes';
import nutritionistRouter from '@/routes/nutritionist.routes';
import adminRouter from '@/routes/admin.routes';
import fnriRouter from '@/routes/fnri.routes';
import mealsRouter from '@/routes/meals.routes';
import groceryRouter from '@/routes/grocery.routes';
import progressRouter from '@/routes/progress.routes';
import cronRouter from '@/routes/cron.routes';
import nutritionistApplicationRouter from '@/routes/nutritionist-application.routes';
import evidenceRouter from '@/routes/evidence.routes';
import notificationsRouter from '@/routes/notifications.routes';
import membershipRouter from '@/routes/membership.routes';
import membershipPaymentRouter from '@/routes/membership-payment.routes';
import { MEMBERSHIP_PRICES, testCheckoutConfig } from '@/domain/membership-checkout.policy';

// Initialize Express app
const app = express();
// Personalized API responses must not turn into bodyless 304 responses during
// auth hydration or safety/profile refreshes.
app.disable('etag');
if (env.TRUST_PROXY) app.set('trust proxy', 1);

if (env.NODE_ENV !== 'production' || env.API_DOCS_ENABLED) {
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openApiDocument));
}

// Apply security and global middleware
app.use(helmet());
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.slice(0, 100) || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});
app.use(cors(createCorsOptions(env.allowedCorsOrigins)));
// The signature covers the original bytes. Keep this before the JSON parser.
app.use(
  '/api/payments/paymongo/webhook',
  express.raw({ type: 'application/json', limit: '64kb' }),
  membershipPaymentRouter
);
// Applicant media is bounded by its schema (1 MB headshot + 500 KB signature).
app.use('/api/nutritionist-applications', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
// Vercel's external rewrite must never cache personalized API responses.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
// Authentication has endpoint-specific limits. A busy onboarding or browsing
// session must not prevent the user from signing in or refreshing a session.
app.use('/api/auth', authRouter);
app.use('/api', apiLimiter);
app.use('/api', liveMutationUpdates);

// SMTP verification is an explicit startup check because it opens an external
// connection. Email delivery remains available even when this check is disabled.
if (env.SMTP_VERIFY_ON_STARTUP) {
  void verifyEmailTransporter();
}

// Mount API Routers
app.use('/api/live', liveRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/notifications', notificationsRouter);
app.get('/api/membership/plans', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    success: true,
    data: {
      prices: MEMBERSHIP_PRICES,
      currency: 'PHP',
      mode: 'TEST',
      autoRenews: false,
      purchasesAvailable: Boolean(testCheckoutConfig()),
    },
  });
});
// These specific user routers own their auth and readiness checks. Mount them
// before the broad /api/user router so a request does not run both chains.
app.use('/api/user/progress', progressRouter);
app.use('/api/user/membership', membershipRouter);
app.use('/api/user/meals', mealsRouter);
app.use('/api/user/grocery', groceryRouter);
app.use('/api/user', userRouter);
app.use('/api/nutritionist', nutritionistRouter);
app.use('/api/admin', adminRouter);
app.use('/api/fnri', fnriRouter);
app.use('/api/cron', cronRouter);
app.use('/api/nutritionist-applications', nutritionistApplicationRouter);

// Base health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'NutriMind API is running',
    ...(isCapstoneDemo() ? { deploymentMode: 'capstone-demo', notice: CAPSTONE_DEMO_NOTICE } : {}),
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ success: true, message: 'NutriMind API is ready' });
  } catch {
    return res.status(503).json({ success: false, message: 'NutriMind API is not ready' });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
