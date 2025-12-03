/**
 * server/index.ts
 * Purpose: Configures the Express Application.
 */
import express from 'express';
import cors from 'cors';
import router from './router';
import { errorHandler } from '../errors/errorHandler';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { impersonationMiddleware } from '../middlewares/impersonationMiddleware';

const app = express();

// Global Middlewares
// Fix: cast to any to resolve NextHandleFunction vs RequestHandler type mismatch errors
app.use(cors({ origin: true }) as any);
app.use(express.json() as any);

// Apply Impersonation Middleware first (checks X-Impersonation-Token header)
app.use(impersonationMiddleware as any);

// Company Context is now handled by TenantRouter for specific routes
// app.use(companyContextMiddleware as any);

// Mount Routes
app.use('/api/v1', router as any);

// Global Error Handler (Must be last)
app.use(errorHandler as any);

export default app;
