
import { BundleDefinition } from '../../../domain/super-admin/BundleDefinition';

/**
 * Repository interface for Bundle Registry management.
 */
export interface IBundleRegistryRepository {
  getAll(): Promise<BundleDefinition[]>;
  getById(id: string): Promise<BundleDefinition | null>;
  create(bundle: BundleDefinition): Promise<void>;
  update(id: string, bundle: Partial<BundleDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
