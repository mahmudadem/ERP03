"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
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
const firebaseAdmin_1 = __importDefault(require("../../../firebaseAdmin"));
exports.db = firebaseAdmin_1.default.firestore();
exports.fcm = firebaseAdmin_1.default.messaging();
/**
 * Helper to Convert Firestore Timestamps to JS Dates in objects
 */
const convertTimestamps = (data) => {
    if (!data)
        return data;
    if (data instanceof firebaseAdmin_1.default.firestore.Timestamp) {
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