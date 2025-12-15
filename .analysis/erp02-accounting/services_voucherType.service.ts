// services/voucherType.service.ts
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { VoucherTypeConfig } from '../types';

/**
 * Get all voucher type configurations for a company.
 * @param companyId - The company ID
 * @returns Promise resolving to array of VoucherTypeConfig
 */
export async function getVoucherTypes(companyId: string): Promise<VoucherTypeConfig[]> {
    const voucherTypesRef = collection(db, 'companies', companyId, 'voucher_types');
    const snapshot = await getDocs(voucherTypesRef);

    const voucherTypes: VoucherTypeConfig[] = [];
    snapshot.forEach(doc => {
        voucherTypes.push(doc.data() as VoucherTypeConfig);
    });

    return voucherTypes;
}

/**
 * Get a single voucher type configuration by ID.
 * @param companyId - The company ID
 * @param voucherTypeId - The voucher type ID
 * @returns Promise resolving to VoucherTypeConfig or null if not found
 */
export async function getVoucherType(
    companyId: string,
    voucherTypeId: string
): Promise<VoucherTypeConfig | null> {
    const voucherTypeRef = doc(db, 'companies', companyId, 'voucher_types', voucherTypeId);
    const snapshot = await getDoc(voucherTypeRef);

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data() as VoucherTypeConfig;
}

/**
 * Save (create or update) a voucher type configuration.
 * If createdAt is missing, it will be set to current timestamp.
 * @param companyId - The company ID
 * @param config - The voucher type configuration to save
 * @returns Promise<void>
 */
export async function saveVoucherType(
    companyId: string,
    config: VoucherTypeConfig
): Promise<void> {
    const voucherTypeRef = doc(db, 'companies', companyId, 'voucher_types', config.id);

    // Ensure createdAt is set for new voucher types
    const dataToSave: VoucherTypeConfig = {
        ...config,
        createdAt: config.createdAt || Date.now()
    };

    await setDoc(voucherTypeRef, dataToSave);
}

/**
 * Delete a voucher type configuration.
 * @param companyId - The company ID
 * @param voucherTypeId - The voucher type ID to delete
 * @returns Promise<void>
 */
export async function deleteVoucherType(
    companyId: string,
    voucherTypeId: string
): Promise<void> {
    const voucherTypeRef = doc(db, 'companies', companyId, 'voucher_types', voucherTypeId);
    await deleteDoc(voucherTypeRef);
}
