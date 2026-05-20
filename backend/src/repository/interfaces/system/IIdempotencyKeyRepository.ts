import { IdempotencyKeyRecord } from '../../../domain/system/entities/IdempotencyKey';

export interface IIdempotencyKeyRepository {
  get(companyId: string, key: string): Promise<IdempotencyKeyRecord | null>;
  put(record: IdempotencyKeyRecord): Promise<void>;
  delete(companyId: string, key: string): Promise<void>;
}
