// services/finance.service.ts
import { collection, onSnapshot, doc, query, orderBy, runTransaction } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, app } from '../firebase';
import { FinancialTransaction, Account, FinancialVoucher, VoucherStatus, User, Notification, BalanceSheetResponse } from '../types';


export const onTransactionsChange = (
    companyId: string,
    callback: (transactions: FinancialTransaction[]) => void,
    onError: (error: Error) => void
) => {
    if (!db) {
        onError(new Error("Firestore is not initialized."));
        return () => {};
    }
    if (!companyId) return () => {};
    const transactionsCollectionRef = collection(db, "companies", companyId, "financial_transactions");
    const q = query(transactionsCollectionRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as FinancialTransaction[];
        callback(transactions);
    }, (error) => {
        console.error("Error listening to transactions collection:", error);
        onError(error);
    });

    return unsubscribe;
};

export const onVouchersChange = (
    companyId: string,
    callback: (vouchers: FinancialVoucher[]) => void,
    onError: (error: Error) => void
) => {
    if (!db) {
        onError(new Error("Firestore is not initialized."));
        return () => {};
    }
    if (!companyId) return () => {};
    const vouchersCollectionRef = collection(db, "companies", companyId, "financial_vouchers");
    const q = query(vouchersCollectionRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const vouchers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as FinancialVoucher[];
        callback(vouchers);
    }, (error) => {
        console.error("Error listening to vouchers collection:", error);
        onError(error);
    });

    return unsubscribe;
};


export const postTransaction = async (companyId: string, transactionData: Omit<FinancialTransaction, 'id' | 'created_at'>): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");

    const debitAccountRef = doc(db, "companies", companyId, "accounts", transactionData.debit_account_id);
    const creditAccountRef = doc(db, "companies", companyId, "accounts", transactionData.credit_account_id);

    await runTransaction(db, async (firestoreTransaction) => {
        const debitAccountDoc = await firestoreTransaction.get(debitAccountRef);
        const creditAccountDoc = await firestoreTransaction.get(creditAccountRef);

        if (!debitAccountDoc.exists() || !creditAccountDoc.exists()) {
            throw new Error("One or both accounts could not be found.");
        }

        const debitAccount = debitAccountDoc.data() as Account;
        const creditAccount = creditAccountDoc.data() as Account;

        if (!debitAccount.is_active || !creditAccount.is_active) {
            throw new Error("One of the selected accounts is inactive.");
        }

        const newDebitBalance = debitAccount.current_balance + transactionData.amount;
        const newCreditBalance = creditAccount.current_balance - transactionData.amount;
        
        // Update account balances
        firestoreTransaction.update(debitAccountRef, { current_balance: newDebitBalance });
        firestoreTransaction.update(creditAccountRef, { current_balance: newCreditBalance });

        // Add the financial transaction record
        const transactionCollectionRef = collection(db, "companies", companyId, "financial_transactions");
        firestoreTransaction.set(doc(transactionCollectionRef), {
            ...transactionData,
            created_at: new Date().toISOString(),
        });
    });
};

export const saveVoucher = async (companyId: string, voucherData: FinancialVoucher, _userProfile: User, _accounts: Account[]): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    const functions = getFunctions(app, 'us-central1');
    const callable = httpsCallable(functions, 'saveVoucherSecure');
    const res: any = await callable({ companyId, voucher: voucherData });
    return res?.data?.id || voucherData.id;
};

export const changeVoucherStatus = async (companyId: string, voucherId: string, targetStatus: VoucherStatus, reason?: string): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    const functionsInstance = getFunctions(app, 'us-central1');
    const callable = httpsCallable(functionsInstance, 'changeVoucherStatus');
    await callable({ companyId, voucherId, targetStatus, reason });
};

export const approveVoucher = async (companyId: string, voucherId: string, _approverProfile: User): Promise<void> => {
    await changeVoucherStatus(companyId, voucherId, VoucherStatus.APPROVED);
};

export const deleteVoucher = async (companyId: string, voucherId: string): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    if (!voucherId) throw new Error("Voucher ID is required.");
    const functionsInstance = getFunctions(app, 'us-central1');
    const callable = httpsCallable(functionsInstance, 'deleteVoucherSecure');
    await callable({ companyId, voucherId });
};

export const generateBalanceSheet = async (companyId: string, periodId: string): Promise<BalanceSheetResponse> => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    if (!periodId) throw new Error("Period ID is required.");
    const functionsInstance = getFunctions(app, 'us-central1');
    const callable = httpsCallable(functionsInstance, 'generateBalanceSheet');
    const res: any = await callable({ companyId, periodId });
    return res.data as BalanceSheetResponse;
};
