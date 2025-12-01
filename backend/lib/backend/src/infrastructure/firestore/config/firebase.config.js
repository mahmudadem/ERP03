"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertTimestamps = exports.fcm = exports.db = void 0;
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
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = admin.firestore();
exports.fcm = admin.messaging();
/**
 * Helper to Convert Firestore Timestamps to JS Dates in objects
 */
const convertTimestamps = (data) => {
    if (!data)
        return data;
    if (data instanceof admin.firestore.Timestamp) {
        return data.toDate();
    }
    if (Array.isArray(data)) {
        return data.map(exports.convertTimestamps);
    }
    if (typeof data === 'object') {
        const result = {};
        for (const key of Object.keys(data)) {
            result[key] = (0, exports.convertTimestamps)(data[key]);
        }
        return result;
    }
    return data;
};
exports.convertTimestamps = convertTimestamps;
//# sourceMappingURL=firebase.config.js.map