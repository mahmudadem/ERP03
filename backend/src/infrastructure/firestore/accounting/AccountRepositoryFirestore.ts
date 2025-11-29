import { firestore } from 'firebase-admin';
import { Account } from '../../../domain/accounting/models/Account';
import { IAccountRepository, NewAccountInput, UpdateAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';

export class AccountRepositoryFirestore implements IAccountRepository {
    constructor(private db: firestore.Firestore) { }

    private getCollection(companyId: string) {
        return this.db.collection(`companies/${companyId}/accounts`);
    }

    async list(companyId: string): Promise<Account[]> {
        const snapshot = await this.getCollection(companyId).get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Account));
    }

    async getById(companyId: string, accountId: string): Promise<Account | null> {
        const doc = await this.getCollection(companyId).doc(accountId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as Account;
    }

    async getByCode(companyId: string, code: string): Promise<Account | null> {
        const snapshot = await this.getCollection(companyId).where('code', '==', code).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Account;
    }

    async create(companyId: string, data: NewAccountInput): Promise<Account> {
        const ref = this.getCollection(companyId).doc();
        const now = new Date().toISOString();
        const account: Account = {
            id: ref.id,
            companyId,
            ...data,
            isActive: true,
            isProtected: false,
            createdAt: now,
            updatedAt: now,
        };
        await ref.set(account);
        return account;
    }

    async update(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account> {
        const ref = this.getCollection(companyId).doc(accountId);
        const updates = {
            ...data,
            updatedAt: new Date().toISOString(),
        };
        await ref.update(updates);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as Account;
    }

    async deactivate(companyId: string, accountId: string): Promise<void> {
        const ref = this.getCollection(companyId).doc(accountId);
        await ref.update({
            isActive: false,
            updatedAt: new Date().toISOString(),
        });
    }

    async hasChildren(companyId: string, accountId: string): Promise<boolean> {
        const snapshot = await this.getCollection(companyId).where('parentId', '==', accountId).limit(1).get();
        return !snapshot.empty;
    }
}
