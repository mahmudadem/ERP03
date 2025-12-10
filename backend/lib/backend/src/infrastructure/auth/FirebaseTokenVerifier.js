"use strict";
/**
 * FirebaseTokenVerifier.ts
 *
 * Purpose: Firebase-specific implementation of ITokenVerifier.
 * Uses Firebase Admin SDK to verify ID tokens.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseTokenVerifier = void 0;
const firebaseAdmin_1 = __importDefault(require("../../firebaseAdmin"));
class FirebaseTokenVerifier {
    /**
     * Verifies a Firebase ID token and returns a normalized DecodedToken.
     *
     * @param token - Firebase ID token from the client
     * @returns Normalized decoded token payload
     * @throws Error if token is invalid, expired, or revoked
     */
    async verify(token) {
        const decoded = await firebaseAdmin_1.default.auth().verifyIdToken(token);
        return {
            uid: decoded.uid,
            email: decoded.email,
            emailVerified: decoded.email_verified,
            name: decoded.name,
            picture: decoded.picture,
            iat: decoded.iat,
            exp: decoded.exp,
            claims: Object.assign({ 
                // Preserve Firebase-specific claims that might be needed
                firebase: decoded.firebase }, Object.fromEntries(Object.entries(decoded).filter(([key]) => !['uid', 'email', 'email_verified', 'name', 'picture', 'iat', 'exp', 'aud', 'iss', 'sub', 'auth_time', 'firebase'].includes(key)))),
        };
    }
}
exports.FirebaseTokenVerifier = FirebaseTokenVerifier;
//# sourceMappingURL=FirebaseTokenVerifier.js.map