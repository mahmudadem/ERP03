/**
 * server/index.ts
 * Purpose: Configures the Express Application.
 */
import * as express from 'express';
import * as cors from 'cors';
import router from './router';
import { errorHandler } from '../errors/errorHandler';

const app = express();

// Global Middlewares
// Fix: cast to any to resolve NextHandleFunction vs RequestHandler type mismatch errors
app.use(cors({ origin: true }) as any);
app.use(express.json() as any);

// Mount Routes
app.use('/api/v1', router as any);

// Global Error Handler (Must be last)
app.use(errorHandler as any);

export default app;