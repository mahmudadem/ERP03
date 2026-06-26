import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PolicyConfig } from '../../../../domain/system-core/entities/PolicyConfig';
import { IPolicyConfigRepository } from '../../../../repository/interfaces/system-core/IPolicyConfigRepository';

/**
 * FirestorePolicyConfigRepository — Firestore implementation of the neutral
 * engine-owned `IPolicyConfigRepository`.
 *
 * Task 267-D (Engine Management API Doorways): one `PolicyConfig` document
 * per company, written by any module's policy doorway (POS / Sales / Purchases
 * / company settings). It is the single source of truth that the
 * `PolicyEngine.resolveTyped(...)` consults.
 *
 * Storage location: `companies/{companyId}/systemCorePolicies/{companyId}`
 * — keyed by companyId (mirrors `FirestoreSellingPolicyRepository` and
 * `FirestorePosPolicyRepository`) so the doc can be addressed as the
 * canonical "one per company" policy document.
 *
 * The collection name uses the `systemCorePolicies` segment to make it
 * explicit that this is an engine-owned (System Core) store, not a
 * module-local one.
 */
export class FirestorePolicyConfigRepository implements IPolicyConfigRepository {
  constructor(private readonly db: Firestore) {}

  private docRef(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('systemCorePolicies')
      .doc(companyId);
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async getConfig(companyId: string): Promise<PolicyConfig | null> {
    const ref = this.docRef(companyId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;
    // CTO review feedback 267-D: a malformed / legacy document MUST NOT
    // fail open. The engine's `resolveTyped` has a fail-closed
    // `repositoryError` path that returns BLOCK on any thrown error; if
    // we silently swallowed a corrupt payload here, the resolver would
    // treat that as "no rules → ALLOW" and grant permissions the tenant
    // never configured. Throw so the engine's catch surfaces
    // `PolicyConfig.repositoryError` and the audit chain records the
    // degraded mode. (A missing document is still null — that path
    // correctly falls through to default-allow because it represents
    // "no configuration exists yet", not "configuration is corrupt".)
    //
    // `PolicyConfig.fromJSON` is intentionally lenient (it coerces a
    // non-array `rules` to `[]`), so we must validate the raw payload
    // shape BEFORE calling it. Any present-but-corrupt document must
    // throw here.
    if (!isPolicyConfigShape(data)) {
      throw new Error(
        `PolicyConfig document for company ${companyId} is malformed: ${describeShapeProblem(data)}`
      );
    }
    return PolicyConfig.fromJSON(data);
  }

  async saveConfig(config: PolicyConfig, transaction?: unknown): Promise<void> {
    // Refresh updatedAt so audit/UI gets a stable timestamp. The entity
    // also normalises every rule through its constructor (rejects missing
    // id / action / scope) so an invalid rule can never be persisted.
    config.updatedAt = new Date();
    const ref = this.docRef(config.companyId);
    const payload = config.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload, { merge: true });
      return;
    }
    await ref.set(payload, { merge: true });
  }
}

/**
 * Strict shape check applied to the raw Firestore payload BEFORE the
 * lenient `PolicyConfig.fromJSON` runs. The entity's `fromJSON` coerces
 * a non-array `rules` to `[]`, so a corrupt document would otherwise be
 * treated as "no rules" (default-allow). The repository must surface
 * corrupt data as a throw so `PolicyEngine.resolveTyped` reaches its
 * fail-closed `PolicyConfig.repositoryError` path.
 *
 * Pinned by `FirestorePolicyConfigRepository.test.ts` (CTO 267-D).
 */
const isPolicyConfigShape = (data: any): boolean => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (typeof data.companyId !== 'string' || data.companyId.length === 0) return false;
  if (!Array.isArray(data.rules)) return false;
  return true;
};

const describeShapeProblem = (data: any): string => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return `payload is not an object (got ${Array.isArray(data) ? 'array' : typeof data})`;
  }
  if (typeof data.companyId !== 'string' || data.companyId.length === 0) {
    return `companyId is missing or not a non-empty string (got ${typeof data.companyId})`;
  }
  if (!Array.isArray(data.rules)) {
    return `rules is not an array (got ${typeof data.rules})`;
  }
  return 'unknown shape problem';
};
