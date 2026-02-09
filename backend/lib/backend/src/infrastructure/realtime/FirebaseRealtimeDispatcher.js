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
exports.FirebaseRealtimeDispatcher = void 0;
const admin = __importStar(require("firebase-admin"));
/**
 * Firebase Realtime Database implementation of IRealtimeDispatcher.
 *
 * Writes notifications to `/notifications/{companyId}/{userId}/{notificationId}`
 * Frontend listens to this path for real-time updates.
 */
class FirebaseRealtimeDispatcher {
    constructor() {
        this.rtdb = admin.database();
    }
    /**
     * Push a notification to a single user in real-time
     */
    async pushToUser(companyId, userId, notification) {
        const path = `notifications/${companyId}/${userId}/${notification.id}`;
        await this.rtdb.ref(path).set(notification.toJSON());
    }
    /**
     * Push a notification to multiple users in real-time
     */
    async pushToMany(companyId, userIds, notification) {
        const updates = {};
        for (const userId of userIds) {
            const path = `notifications/${companyId}/${userId}/${notification.id}`;
            updates[path] = notification.toJSON();
        }
        await this.rtdb.ref().update(updates);
    }
}
exports.FirebaseRealtimeDispatcher = FirebaseRealtimeDispatcher;
//# sourceMappingURL=FirebaseRealtimeDispatcher.js.map