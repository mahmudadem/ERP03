import { PostingLog } from '../../../domain/accounting/entities/PostingLog';

export interface IPostingLogRepository {
  /** Persist a new PostingLog record. */
  create(log: PostingLog, transaction?: unknown): Promise<void>;

  /** Get a single record by id. */
  getById(companyId: string, id: string): Promise<PostingLog | null>;

  /** Find all PostingLog records for a given source document (SI, PI, DN, etc.). */
  findBySourceId(companyId: string, sourceId: string): Promise<PostingLog[]>;

  /** Find PostingLog records by source module/type for reporting/audit. */
  listBySource(
    companyId: string,
    filter: { sourceModule?: string; sourceType?: string; limit?: number }
  ): Promise<PostingLog[]>;
}
