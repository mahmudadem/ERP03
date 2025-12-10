"use strict";
/**
 * SignupUseCase.ts
 *
 * Purpose: Handles new user registration.
 * Creates Firebase Auth account and corresponding User record in database.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignupUseCase = void 0;
const firebaseAdmin_1 = __importDefault(require("../../../firebaseAdmin"));
const User_1 = require("../../../domain/core/entities/User");
const ApiError_1 = require("../../../api/errors/ApiError");
class SignupUseCase {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute(input) {
        // Validate input
        this.validateInput(input);
        const fullName = `${input.firstName} ${input.lastName}`.trim();
        // Check if user already exists in our database
        const existingUser = await this.userRepository.findByEmail(input.email);
        if (existingUser) {
            throw ApiError_1.ApiError.badRequest('Email already registered');
        }
        let firebaseUser;
        try {
            // Create Firebase Auth user
            firebaseUser = await firebaseAdmin_1.default.auth().createUser({
                email: input.email,
                password: input.password,
                displayName: fullName,
                emailVerified: false,
            });
        }
        catch (error) {
            if (error.code === 'auth/email-already-exists') {
                throw ApiError_1.ApiError.badRequest('Email already registered');
            }
            if (error.code === 'auth/weak-password') {
                throw ApiError_1.ApiError.badRequest('Password is too weak. Use at least 6 characters.');
            }
            throw ApiError_1.ApiError.internal('Failed to create account');
        }
        // Create user record in our database
        const user = new User_1.User(firebaseUser.uid, input.email, fullName, 'USER', new Date(), undefined, // pictureUrl
        undefined, // planId - not set yet
        undefined // activeCompanyId - not set yet
        );
        await this.userRepository.createUser(user);
        return {
            userId: firebaseUser.uid,
            email: input.email,
            name: fullName,
            needsPlan: true, // New users always need to select a plan
        };
    }
    validateInput(input) {
        var _a;
        if (!input.email || typeof input.email !== 'string') {
            throw ApiError_1.ApiError.badRequest('Email is required');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.email)) {
            throw ApiError_1.ApiError.badRequest('Invalid email format');
        }
        if (!input.password || input.password.length < 6) {
            throw ApiError_1.ApiError.badRequest('Password must be at least 6 characters');
        }
        if (!((_a = input.firstName) === null || _a === void 0 ? void 0 : _a.trim())) {
            throw ApiError_1.ApiError.badRequest('First name is required');
        }
    }
}
exports.SignupUseCase = SignupUseCase;
//# sourceMappingURL=SignupUseCase.js.map