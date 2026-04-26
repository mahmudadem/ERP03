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

const normalizeModule = (module?: string) =>
  String(module || '').trim().toUpperCase();

const inferVoucherModule = (data: Record<string, any>, id: string): string => {
  const explicitModule = normalizeModule(data.module);
  if (explicitModule) return explicitModule;

  const token = [id, data.id, data.code, data.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(sales[_\s-]*(order|invoice|return)|delivery[_\s-]*note)/.test(token)) {
    return 'SALES';
  }

  if (/(purchase[_\s-]*(order|invoice|return)|goods[_\s-]*receipt)/.test(token)) {
    return 'PURCHASE';
  }

  if (/(journal[_\s-]*entry|payment|receipt|opening[_\s-]*balance|fx[_\s-]*revaluation)/.test(token)) {
    return 'ACCOUNTING';
  }

  return '';
};

export async function loadSystemVoucherTypes(moduleFilter?: string): Promise<SystemVoucherType[]> {
  try {
    const vouchersRef = collection(db, 'system_metadata', 'voucher_types', 'items');
    const snapshot = await getDocs(vouchersRef);
    const normalizedModuleFilter = moduleFilter ? normalizeModule(moduleFilter) : null;
    
    let vouchers: SystemVoucherType[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const module = inferVoucherModule(data, doc.id);

      vouchers.push({
        id: doc.id,
        name: data.name || doc.id,
        code: data.code || doc.id.toUpperCase(),
        prefix: data.prefix || '',
        module,
        description: data.description,
        schemaVersion: data.schemaVersion || 2,
        isRecommended: data.isRecommended || false,
      });
    });

    if (normalizedModuleFilter) {
      vouchers = vouchers.filter(v => v.module === normalizedModuleFilter);
    }

    return vouchers;
  } catch (error) {
    console.error('Failed to load system voucher types:', error);
    return [];
  }
}
