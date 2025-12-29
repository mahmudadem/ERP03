import * as admin from 'firebase-admin';
import { IAccountLookupService, AccountWithAccess } from '../../../domain/accounting/services/IAccountLookupService';

/**
 * FirestoreAccountLookupService
 * 
 * Efficient bulk account loading from Firestore.
 * Uses batched reads to avoid N+1 queries.
 */
export class FirestoreAccountLookupService implements IAccountLookupService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  async getAccountsByIds(
    companyId: string,
    accountIds: string[]
  ): Promise<Map<string, AccountWithAccess>> {
    const accountMap = new Map<string, AccountWithAccess>();

    if (accountIds.length === 0) {
      return accountMap;
    }

    try {
      // Firestore 'in' query limited to 10 items, batch if needed
      const batchSize = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < accountIds.length; i += batchSize) {
        batches.push(accountIds.slice(i, i + batchSize));
      }

      const accountsRef = this.db
        .collection('companies')
        .doc(companyId)
        .collection('accounts');

      // Execute all batches in parallel
      const allSnapshots = await Promise.all(
        batches.map(batch =>
          accountsRef.where(admin.firestore.FieldPath.documentId(), 'in', batch).get()
        )
      );

      // Merge results
      for (const snapshot of allSnapshots) {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          accountMap.set(doc.id, {
            id: doc.id,
            code: data.code || doc.id,
            name: data.name || 'Unknown',
            type: data.type || 'other', // Map account type for policy evaluation
            ownerUnitIds: data.ownerUnitIds,
            ownerScope: data.ownerScope
          });
        });
      }

      return accountMap;
    } catch (error) {
      console.error(`Failed to load accounts for company ${companyId}:`, error);
      // Return empty map on error (policy will fail safely)
      return accountMap;
    }
  }
}
