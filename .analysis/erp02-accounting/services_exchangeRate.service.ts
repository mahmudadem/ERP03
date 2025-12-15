// services/exchangeRate.service.ts
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from '../firebase';
import { ExchangeRate } from '../types';

const getRatesCollection = (companyId: string) => collection(db, "companies", companyId, "exchange_rates");

export const onExchangeRatesChange = (
    companyId: string,
    callback: (rates: ExchangeRate[]) => void,
    onError: (error: Error) => void
) => {
    if (!db) {
        onError(new Error("Firestore is not initialized."));
        return () => {};
    }
    if (!companyId) return () => {};
    const exchangeRatesCollectionRef = getRatesCollection(companyId);
    const unsubscribe = onSnapshot(exchangeRatesCollectionRef, (snapshot) => {
        const rates = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ExchangeRate[];
        callback(rates);
    }, (error) => {
        console.error("Error listening to exchange rates collection:", error);
        onError(error);
    });

    return unsubscribe;
};

export const addExchangeRate = async (companyId: string, newRate: Omit<ExchangeRate, 'id'>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    await addDoc(getRatesCollection(companyId), newRate);
};

export const updateExchangeRate = async (companyId: string, id: string, updatedRate: Partial<Omit<ExchangeRate, 'id'>>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    const rateDoc = doc(db, "companies", companyId, "exchange_rates", id);
    await updateDoc(rateDoc, updatedRate);
};

export const deleteExchangeRate = async (companyId: string, id: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    const rateDoc = doc(db, "companies", companyId, "exchange_rates", id);
    await deleteDoc(rateDoc);
};
