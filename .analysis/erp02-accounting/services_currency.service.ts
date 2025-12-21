// services/currency.service.ts
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from '../firebase';
import { Currency } from '../types';

const getCurrenciesCollection = (companyId: string) => collection(db, "companies", companyId, "currencies");

export const onCurrenciesChange = (
    companyId: string,
    callback: (currencies: Currency[]) => void,
    onError: (error: Error) => void
) => {
    if (!db) {
        onError(new Error("Firestore is not initialized."));
        return () => {};
    }
    if (!companyId) return () => {};
    const currenciesCollectionRef = getCurrenciesCollection(companyId);
    const unsubscribe = onSnapshot(currenciesCollectionRef, (snapshot) => {
        const currencies = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Currency[];
        callback(currencies);
    }, (error) => {
        console.error("Error listening to currencies collection:", error);
        onError(error);
    });

    return unsubscribe;
};

export const addCurrency = async (companyId: string, newCurrency: Omit<Currency, 'id'>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    await addDoc(getCurrenciesCollection(companyId), newCurrency);
};

export const updateCurrency = async (companyId: string, id: string, updatedCurrency: Partial<Omit<Currency, 'id'>>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    const currencyDoc = doc(db, "companies", companyId, "currencies", id);
    await updateDoc(currencyDoc, updatedCurrency);
};

export const deleteCurrency = async (companyId: string, id: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    const functions = getFunctions(app, 'us-central1');
    const callable = httpsCallable(functions, 'deleteCompanyCurrency');
    await callable({ companyId, currencyId: id });
};
