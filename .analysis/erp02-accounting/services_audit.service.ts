// services/audit.service.ts
import { collection, addDoc } from "firebase/firestore";
import { db } from '../firebase';
import { AuditLog } from '../types';

export const addAuditLog = async (companyId: string, logData: Omit<AuditLog, 'id' | 'timestamp'>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!companyId) throw new Error("Company ID is required for audit logging.");
    
    const logWithTimestamp = {
        ...logData,
        timestamp: new Date().toISOString(),
    };
    
    await addDoc(collection(db, "companies", companyId, "audit_logs"), logWithTimestamp);
};
