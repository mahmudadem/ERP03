/**
 * SignupUseCase.ts
 * 
 * Purpose: Handles new user registration.
 * Creates Firebase Auth account and corresponding User record in database.
 */

import admin from '../../../firebaseAdmin';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { User } from '../../../domain/core/entities/User';
import { ApiError } from '../../../api/errors/ApiError';

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SignupResult {
  userId: string;
  email: string;
  name: string;
  needsPlan: boolean;
}

export class SignupUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(input: SignupInput): Promise<SignupResult> {
    // Normalize email
    input.email = input.email.trim().toLowerCase();

    // Validate input
    this.validateInput(input);

    const fullName = `${input.firstName} ${input.lastName}`.trim();

    // Check if user already exists in our database
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw ApiError.badRequest('Email already registered');
    }

    let firebaseUser: admin.auth.UserRecord;

    try {
      // Create Firebase Auth user
      firebaseUser = await admin.auth().createUser({
        email: input.email,
        password: input.password,
        displayName: fullName,
        emailVerified: false,
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        throw ApiError.badRequest('Email already registered');
      }
      if (error.code === 'auth/weak-password') {
        throw ApiError.badRequest('Password is too weak. Use at least 6 characters.');
      }
      throw ApiError.internal('Failed to create account');
    }

    // Create user record in our database
    const user = new User(
      firebaseUser.uid,
      input.email,
      fullName,
      'USER',
      new Date(),
      undefined, // pictureUrl
      undefined, // planId - not set yet
      undefined  // activeCompanyId - not set yet
    );

    try {
      await this.userRepository.createUser(user);
    } catch (error) {
      // Rollback: delete auth user validation failed or db error
      await admin.auth().deleteUser(firebaseUser.uid).catch(err => 
        console.error(`[SignupUseCase] Failed to rollback auth user ${firebaseUser.uid}`, err)
      );
      throw error;
    }

    return {
      userId: firebaseUser.uid,
      email: input.email,
      name: fullName,
      needsPlan: true, // New users always need to select a plan
    };
  }

  private validateInput(input: SignupInput): void {
    if (!input.email || typeof input.email !== 'string') {
      throw ApiError.badRequest('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw ApiError.badRequest('Invalid email format');
    }

    if (!input.password || input.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    if (!input.firstName?.trim()) {
      throw ApiError.badRequest('First name is required');
    }
  }
}
