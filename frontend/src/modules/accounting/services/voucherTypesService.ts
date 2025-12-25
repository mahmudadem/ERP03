/**
 * Load system voucher types from Firestore
 */
import { db } from '../../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface SystemVoucherType {
  id: string;
  name: string;
  code: string;
  prefix: string;
  description?: string;
  schemaVersion: number;
  isRecommended?: boolean;
}

export async function loadSystemVoucherTypes(): Promise<SystemVoucherType[]> {
  try {
    const vouchersRef = collection(db, 'system_metadata', 'voucher_types', 'items');
    const snapshot = await getDocs(vouchersRef);
    
    const vouchers: SystemVoucherType[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      vouchers.push({
        id: doc.id,
        name: data.name || doc.id,
        code: data.code || doc.id.toUpperCase(),
        prefix: data.prefix || '',
        description: data.description,
        schemaVersion: data.schemaVersion || 2,
        isRecommended: data.isRecommended || false,
      });
    });
    return vouchers;
  } catch (error) {
    console.error('Failed to load system voucher types:', error);
    return [];
  }
}
