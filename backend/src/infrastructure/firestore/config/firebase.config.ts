/**
 * firebase.config.ts
 * 
 * Purpose:
 * Initializes the Firebase Admin SDK for server-side operations.
 * Exports the Firestore database instance for use by repositories.
 * 
 * Logic:
 * - Checks if app is already initialized to prevent hot-reload errors.
 * - Uses Application Default Credentials (ADC) or functions config.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const fcm = admin.messaging();

/**
 * Helper to Convert Firestore Timestamps to JS Dates in objects
 */
export const convertTimestamps = (data: any): any => {
  if (!data) return data;
  
  if (data instanceof admin.firestore.Timestamp) {
    return data.toDate();
  }
  
  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }
  
  if (typeof data === 'object') {
    const result: any = {};
    for (const key of Object.keys(data)) {
      result[key] = convertTimestamps(data[key]);
    }
    return result;
  }
  
  return data;
};