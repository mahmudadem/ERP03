import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import server from './api/server';
import { registerAllModules } from './modules';
import { ModuleRegistry } from './application/platform/ModuleRegistry';

// Initialize Admin SDK if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

// Register all modules
registerAllModules();

// Initialize modules
ModuleRegistry.getInstance().initializeAll().catch(console.error);

// Expose the Express App as a Cloud Function
export const api = functions.https.onRequest(server as any);

// Exports for other modules (Background triggers can be added here)
export const accountingModule = {};