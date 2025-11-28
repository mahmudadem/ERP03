
/**
 * bindRepositories.ts
 * 
 * Purpose:
 * Central Dependency Injection setup.
 * Determines which Repository Implementation (Firestore vs Postgres) to use.
 */
import * as admin from 'firebase-admin';
import { db } from '../firestore/config/firebase.config';

// Interfaces
import { ICompanyRepository } from '../../repository/interfaces/core/ICompanyRepository';
import { IUserRepository } from '../../repository/interfaces/core/IUserRepository';
import { IAccountRepository } from '../../repository/interfaces/accounting';
import { IVoucherRepository } from '../../repository/interfaces/accounting';

// Firestore Implementations
import { FirestoreCompanyRepository } from '../firestore/repositories/core/FirestoreCompanyRepository';
import { FirestoreUserRepository } from '../firestore/repositories/core/FirestoreUserRepository';
import { FirestoreAccountRepository } from '../firestore/repositories/accounting/FirestoreAccountRepository';
import { FirestoreVoucherRepository } from '../firestore/repositories/accounting/FirestoreVoucherRepository';

// Helper to ensure DB is init
const getDb = () => {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
};

export const diContainer = {
  get companyRepository(): ICompanyRepository {
    return new FirestoreCompanyRepository(getDb());
  },

  get userRepository(): IUserRepository {
    return new FirestoreUserRepository(getDb());
  },

  get accountRepository(): IAccountRepository {
    return new FirestoreAccountRepository(getDb());
  },

  get voucherRepository(): IVoucherRepository {
    return new FirestoreVoucherRepository(getDb());
  }
};
