import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import server from './api/server';

// Initialize Admin SDK if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

// Expose the Express App as a Cloud Function
export const api = functions.https.onRequest(server as any);

// Exports for other modules (Background triggers can be added here)
export const accountingModule = {};