import admin from '../../../firebaseAdmin';
import { Account } from '../../../domain/accounting/models/Account';
import { AccountType } from '../../../domain/accounting/entities/Account';
import { IAccountRepository, NewAccountInput, UpdateAccountInput } from '../../../repository/interfaces/accounting/IAccountRepository';

export class AccountRepositoryFirestore implements IAccountRepository {
    constructor(private db: FirebaseFirestore.Firestore = admin.firestore()) { }

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
        // Use account CODE as the document ID (industry standard for accounting)
        const ref = this.getCollection(companyId).doc(data.code);
        // Generate UUID for system tracing/logging
        const uuid = this.db.collection('tmp').doc().id;
        const now = new Date();
        const account = {
            id: data.code,       // id = code (business identifier)
            companyId,
            ...data,
            type: data.type as AccountType,
            active: true,
            isActive: true,
            isProtected: false,
            currency: data.currency || '',
            parentId: data.parentId ?? null,
            uuid: uuid,          // System UUID for tracing
            createdAt: now,
            updatedAt: now,
        } as any as Account;
        const payload: any = {
            ...account,
            uuid: uuid,           // Explicitly add UUID to ensure it's persisted
            parentId: account.parentId ?? null,
            updatedAt: account.updatedAt || now,
            createdAt: account.createdAt || now
        };
        // Strip any lingering undefined properties to placate Firestore
        Object.keys(payload).forEach((key) => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });
        await ref.set(payload);
        return account;
    }

    async update(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account> {
        const ref = this.getCollection(companyId).doc(accountId);
        const updates: any = {
            ...data,
            updatedAt: new Date() as any,
        };

        // Normalize parentId and drop undefined values to satisfy Firestore
        if (updates.parentId === '') updates.parentId = null;
        Object.keys(updates).forEach((key) => {
            if (updates[key] === undefined) {
                delete updates[key];
            }
        });

        await ref.update(updates);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as Account;
    }

    async deactivate(companyId: string, accountId: string): Promise<void> {
        const ref = this.getCollection(companyId).doc(accountId);
        await ref.update({
            isActive: false,
            updatedAt: new Date() as any,
        });
    }

    async hasChildren(companyId: string, accountId: string): Promise<boolean> {
        const snapshot = await this.getCollection(companyId).where('parentId', '==', accountId).limit(1).get();
        return !snapshot.empty;
    }

    async getAccounts(companyId: string): Promise<Account[]> {
        return this.list(companyId);
    }
}
