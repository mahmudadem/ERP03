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
  module: string;
  description?: string;
  schemaVersion: number;
  isRecommended?: boolean;
}

export async function loadSystemVoucherTypes(moduleFilter?: string): Promise<SystemVoucherType[]> {
  try {
    const vouchersRef = collection(db, 'system_metadata', 'voucher_types', 'items');
    const snapshot = await getDocs(vouchersRef);
    
    let vouchers: SystemVoucherType[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      vouchers.push({
        id: doc.id,
        name: data.name || doc.id,
        code: data.code || doc.id.toUpperCase(),
        prefix: data.prefix || '',
        module: data.module || 'ACCOUNTING',
        description: data.description,
        schemaVersion: data.schemaVersion || 2,
        isRecommended: data.isRecommended || false,
      });
    });

    if (moduleFilter) {
      vouchers = vouchers.filter(v => v.module === moduleFilter);
    }

    return vouchers;
  } catch (error) {
    console.error('Failed to load system voucher types:', error);
    return [];
  }
}
