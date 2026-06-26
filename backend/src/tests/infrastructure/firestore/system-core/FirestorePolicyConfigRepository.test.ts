import { FirestorePolicyConfigRepository } from '../../../../infrastructure/firestore/repositories/system-core/FirestorePolicyConfigRepository';
import { PolicyConfig } from '../../../../domain/system-core/entities/PolicyConfig';

/**
 * Task 267-D: Firestore implementation of `IPolicyConfigRepository`.
 * One `PolicyConfig` document per company, keyed by companyId, stored at
 * `companies/{companyId}/systemCorePolicies/{companyId}`. This test pins
 * the save/load contract and the malformed-document behavior so the
 * engine's `repositoryError` fail-closed path is reached instead of
 * silently default-allowing on a corrupt document.
 */
describe('FirestorePolicyConfigRepository (Task 267-D)', () => {
  const COMPANY = 'cmp_pcr';

  const makeDb = () => {
    const docs: Record<string, any> = {};
    const makeDoc = (key: string) => ({
      collection: (sub: string) => makeCollection(`${key}/${sub}`),
      get: jest.fn(async () => {
        const data = docs[key];
        return {
          exists: data !== undefined,
          data: () => (data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined),
        };
      }),
      set: jest.fn(async (data: any, opts?: { merge?: boolean }) => {
        if (opts?.merge && docs[key] !== undefined) {
          docs[key] = { ...docs[key], ...data };
        } else {
          docs[key] = { ...data };
        }
      }),
    });
    const makeCollection = (pathPrefix: string) => ({
      doc: (id: string) => makeDoc(`${pathPrefix}/${id}`),
    });
    return {
      collection: (name: string) => makeCollection(name),
      _setRaw: (key: string, data: any) => {
        docs[key] = data;
      },
    };
  };

  it('saves a PolicyConfig and reads it back (save/load contract)', async () => {
    const db = makeDb() as any;
    const repo = new FirestorePolicyConfigRepository(db);

    const cfg = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'pos-direct-sale-allow',
          scope: 'MODULE',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
          reasonCode: 'POS_DIRECT_SALE_ALLOWED',
        },
      ],
    });

    await repo.saveConfig(cfg);
    const loaded = await repo.getConfig(COMPANY);
    expect(loaded).not.toBeNull();
    expect(loaded!.companyId).toBe(COMPANY);
    expect(loaded!.rules).toHaveLength(1);
    expect(loaded!.rules[0].id).toBe('pos-direct-sale-allow');
    expect(loaded!.rules[0].module).toBe('pos');
    expect(loaded!.rules[0].effect).toBe('ALLOW');
  });

  it('returns null when no document exists for the company (no config yet)', async () => {
    const db = makeDb() as any;
    const repo = new FirestorePolicyConfigRepository(db);
    const loaded = await repo.getConfig('cmp_nonexistent');
    // A missing document is NOT an error — it represents "no config yet",
    // which the engine correctly maps to the default-allow fallback.
    // Only a corrupt document must surface as a repositoryError.
    expect(loaded).toBeNull();
  });

  it('passes the entity-boundary guard: bad rules are rejected by the entity, not the repository', async () => {
    // The repository trusts the entity to validate its constructor input.
    // This pins the contract: a `PolicyConfig` with a missing rule id
    // MUST be rejected at the entity boundary, so it can never be
    // persisted by the repository. The audit chain depends on every
    // rule having a stable id.
    expect(() => new PolicyConfig({
      companyId: COMPANY,
      rules: [{ id: '', scope: 'TENANT', action: 'a', effect: 'ALLOW' } as any],
    })).toThrow(/PolicyRule id is required/);
  });

  it('THROWS on a malformed stored document so the engine fails closed (CTO 267-D)', async () => {
    // CTO review feedback 267-D: a malformed / legacy document MUST NOT
    // fail open. The previous implementation swallowed the throw from
    // `PolicyConfig.fromJSON` and returned a default empty config, which
    // the resolver then treated as "no rules → ALLOW" and granted
    // permissions the tenant never configured. The repository must now
    // throw so `PolicyEngine.resolveTyped` catches the error in its
    // fail-closed `PolicyConfig.repositoryError` path and returns BLOCK.
    // Missing document is still null (a separate test above); only a
    // present-but-corrupt document triggers the throw.
    const db = makeDb() as any;
    db._setRaw(`companies/${COMPANY}/systemCorePolicies/${COMPANY}`, { companyId: COMPANY, rules: 'not-an-array' });
    const repo = new FirestorePolicyConfigRepository(db);
    await expect(repo.getConfig(COMPANY)).rejects.toBeDefined();
  });

  it('THROWS on a stored document whose rules fail entity validation (e.g. missing id)', async () => {
    // Even a rule with a missing id (which the entity boundary rejects)
    // must surface as a repository throw — the same fail-closed path
    // applies. The repository never silently rewrites or drops rules.
    const db = makeDb() as any;
    db._setRaw(`companies/${COMPANY}/systemCorePolicies/${COMPANY}`, {
      companyId: COMPANY,
      rules: [{ id: '', scope: 'TENANT', action: 'a', effect: 'ALLOW' }],
    });
    const repo = new FirestorePolicyConfigRepository(db);
    await expect(repo.getConfig(COMPANY)).rejects.toBeDefined();
  });

  it('round-trips a full multi-rule config including thresholds and contexts', async () => {
    const db = makeDb() as any;
    const repo = new FirestorePolicyConfigRepository(db);
    const cfg = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'tenant-hard-block',
          scope: 'TENANT',
          action: 'directSale',
          effect: 'BLOCK',
          isHard: true,
          reasonCode: 'PERIOD_LOCKED',
        },
        {
          id: 'sales-threshold',
          scope: 'MODULE',
          module: 'sales',
          action: 'invoicePosting',
          effect: 'REQUIRE_APPROVAL',
          requireApprovalAbove: 10000,
          reasonCode: 'SALES_INVOICE_OVER_THRESHOLD',
        },
        {
          id: 'pos-context-exemption',
          scope: 'CONTEXT',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
          conditions: { match: { registerId: 'reg-ok' } },
        },
      ],
    });
    await repo.saveConfig(cfg);
    const loaded = await repo.getConfig(COMPANY);
    expect(loaded!.rules).toHaveLength(3);
    expect(loaded!.rules.find((r) => r.id === 'tenant-hard-block')?.isHard).toBe(true);
    expect(loaded!.rules.find((r) => r.id === 'sales-threshold')?.requireApprovalAbove).toBe(10000);
    expect(loaded!.rules.find((r) => r.id === 'pos-context-exemption')?.conditions?.match?.registerId).toBe('reg-ok');
  });

  it('uses a transaction when one is supplied (atomic set)', async () => {
    const db = makeDb() as any;
    const repo = new FirestorePolicyConfigRepository(db);
    const cfg = new PolicyConfig({ companyId: COMPANY, rules: [] });
    const txn = { set: jest.fn() };
    await repo.saveConfig(cfg, txn as any);
    expect(txn.set).toHaveBeenCalledTimes(1);
  });
});
