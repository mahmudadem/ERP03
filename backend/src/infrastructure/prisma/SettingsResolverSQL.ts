/**
 * SettingsResolverSQL.ts
 *
 * SQL-mode counterpart to the Firestore SettingsResolver. In Firestore mode, the
 * resolver returns Firestore DocumentReference / CollectionReference objects that
 * encode *where* data lives (hierarchical path strings). In SQL mode there are no
 * collection paths — table names are fixed in the Prisma schema and rows are
 * scoped by companyId columns, not document paths.
 *
 * This class therefore returns lightweight **descriptor objects** that describe the
 * equivalent SQL scope instead of returning null (which was the original stub and
 * caused runtime crashes). Any code that receives a descriptor and tries to call
 * Firestore-specific methods (.get(), .set(), .where(), …) on it will get a clear
 * TypeError at the point of misuse rather than a silent null-dereference.
 *
 * IMPORTANT: In the current DI binding (bindRepositories.ts) `settingsResolverSQL`
 * is instantiated but NOT passed to any SQL-mode repository — all Prisma repos
 * receive a PrismaClient directly. These descriptors serve two purposes:
 *  1. Satisfy the "no method returns null for valid inputs" acceptance criterion
 *     so that any future consumer that does receive this resolver cannot crash on null.
 *  2. Document the SQL-equivalent scope for each Firestore concept so a reader
 *     can trace: "where does this data live in SQL?" from the descriptor.
 *
 * TODO(275b-audit): CTO — review whether any live code path actually receives and
 * calls methods on `settingsResolverSQL`. If none do, consider deleting the
 * instantiation in bindRepositories.ts and removing this class entirely. If any
 * path does, confirm the callers never invoke Firestore-specific methods on the
 * returned descriptors.
 */

/**
 * Describes a Prisma table scoped to a single document/row (analogous to a
 * Firestore DocumentReference).
 */
export interface SqlDocumentDescriptor {
  readonly _type: 'SqlDocument';
  /** Prisma model name (camelCase, as used in prisma.xxx). */
  readonly table: string;
  /** The companyId that scopes this record. */
  readonly companyId: string;
  /** Optional sub-scope within the table (e.g. moduleId for module settings). */
  readonly scope?: Record<string, string>;
}

/**
 * Describes a Prisma table scoped to a set of rows (analogous to a Firestore
 * CollectionReference).
 */
export interface SqlCollectionDescriptor {
  readonly _type: 'SqlCollection';
  /** Prisma model name (camelCase, as used in prisma.xxx). */
  readonly table: string;
  /** The companyId that scopes these rows. */
  readonly companyId: string;
  /** Optional additional where-clause filters that narrow the collection. */
  readonly filters?: Record<string, string>;
}

export class SettingsResolverSQL {
  /**
   * Tier 1: Global Company Settings
   * Firestore: companies/{id}/Settings/company
   * SQL equivalent: companySettings table WHERE companyId = {id}
   */
  getCompanySettingsRef(companyId: string): SqlDocumentDescriptor {
    return { _type: 'SqlDocument', table: 'companySettings', companyId };
  }

  /**
   * Tier 2a: Shared Module root
   * Firestore: companies/{id}/shared (collection group)
   * SQL equivalent: No single table — shared settings span companyModuleSettings
   * where moduleId = 'shared'.
   *
   * TODO(275b-audit): CTO — "shared module ref" has no direct SQL analogue as a
   * collection group. Returning a descriptor pointing at companyModuleSettings with
   * moduleId='shared'. Confirm this is the correct mapping or whether callers
   * actually use this ref directly.
   */
  getSharedModuleRef(companyId: string): SqlCollectionDescriptor {
    return {
      _type: 'SqlCollection',
      table: 'companyModuleSettings',
      companyId,
      filters: { moduleId: 'shared' },
    };
  }

  /**
   * Tier 2b: Shared Settings document
   * Firestore: companies/{id}/shared/Settings
   * SQL equivalent: companyModuleSettings row WHERE companyId={id} AND moduleId='shared'
   */
  getSharedSettingsRef(companyId: string): SqlDocumentDescriptor {
    return {
      _type: 'SqlDocument',
      table: 'companyModuleSettings',
      companyId,
      scope: { moduleId: 'shared', docType: 'Settings' },
    };
  }

  /**
   * Tier 2c: Shared Data document
   * Firestore: companies/{id}/shared/Data
   * SQL equivalent: No direct equivalent — transactional "shared data" (e.g. exchange
   * rates) have their own dedicated Prisma tables.
   *
   * TODO(275b-audit): CTO — this descriptor is a placeholder; no single SQL table maps
   * to the Firestore shared/Data document.
   */
  getSharedDataRef(companyId: string): SqlDocumentDescriptor {
    return {
      _type: 'SqlDocument',
      table: 'companyModuleSettings',
      companyId,
      scope: { moduleId: 'shared', docType: 'Data' },
    };
  }

  /**
   * Tier 2d: Named sub-collection under shared/Settings
   * Firestore: companies/{id}/shared/Settings/{collectionName}
   * SQL equivalent: varies by collection name (e.g. 'currencies' → companyCurrency table)
   *
   * TODO(275b-audit): CTO — this generic descriptor cannot resolve the correct Prisma
   * table without a mapping table. Callers that need the real table should use the
   * specific helpers (getCurrenciesCollection, etc.) instead.
   */
  getSharedSettingsCollection(companyId: string, collectionName: string): SqlCollectionDescriptor {
    return {
      _type: 'SqlCollection',
      table: collectionName,  // best-effort: Prisma model may differ in casing/name
      companyId,
      filters: { scope: 'shared_settings' },
    };
  }

  /**
   * Tier 2e: Named sub-collection under shared/Data
   * Firestore: companies/{id}/shared/Data/{collectionName}
   * SQL equivalent: varies by collection name
   *
   * TODO(275b-audit): CTO — same mapping concern as getSharedSettingsCollection.
   */
  getSharedDataCollection(companyId: string, collectionName: string): SqlCollectionDescriptor {
    return {
      _type: 'SqlCollection',
      table: collectionName,
      companyId,
      filters: { scope: 'shared_data' },
    };
  }

  /**
   * Tier 3a: Module-specific Settings document
   * Firestore: companies/{id}/{moduleId}/Settings
   * SQL equivalent: companyModuleSettings WHERE companyId={id} AND moduleId={moduleId}
   */
  getModuleSettingsRef(companyId: string, moduleId: string): SqlDocumentDescriptor {
    return {
      _type: 'SqlDocument',
      table: 'companyModuleSettings',
      companyId,
      scope: { moduleId },
    };
  }

  /**
   * Tier 3b: Sub-collection under a module's Settings document
   * Firestore: companies/{id}/{moduleId}/Settings/{collectionName}
   * SQL equivalent: dedicated table for the collection (e.g. taxCategories, costCenters)
   *
   * TODO(275b-audit): CTO — collectionName is not guaranteed to match a Prisma model
   * name. Callers should prefer the specific helpers below (getTaxCategoriesCollection,
   * getCostCentersCollection) rather than this generic method.
   */
  getModuleSubCollectionRef(companyId: string, moduleId: string, collectionName: string): SqlCollectionDescriptor {
    return {
      _type: 'SqlCollection',
      table: collectionName,
      companyId,
      filters: { moduleId },
    };
  }

  /**
   * Tier 3c: Module Data document
   * Firestore: companies/{id}/{moduleId}/Data
   * SQL equivalent: no single document; transactional data lives in dedicated tables
   *
   * TODO(275b-audit): CTO — this descriptor is a placeholder.
   */
  getModuleDataRef(companyId: string, moduleId: string): SqlDocumentDescriptor {
    return {
      _type: 'SqlDocument',
      table: 'companyModuleSettings',
      companyId,
      scope: { moduleId, docType: 'Data' },
    };
  }

  /**
   * Tier 3d: Named sub-collection under a module's Data document
   * Firestore: companies/{id}/{moduleId}/Data/{collectionName}
   * SQL equivalent: dedicated table for the collection
   *
   * TODO(275b-audit): CTO — same mapping concern as getModuleSubCollectionRef.
   */
  getModuleDataCollection(companyId: string, moduleId: string, collectionName: string): SqlCollectionDescriptor {
    return {
      _type: 'SqlCollection',
      table: collectionName,
      companyId,
      filters: { moduleId, docType: 'Data' },
    };
  }

  /**
   * Currencies collection
   * Firestore: companies/{id}/shared/Settings/currencies
   * SQL equivalent: companyCurrency table WHERE companyId = {id}
   */
  getCurrenciesCollection(companyId: string): SqlCollectionDescriptor {
    return { _type: 'SqlCollection', table: 'companyCurrency', companyId };
  }

  /**
   * Exchange rates collection
   * Firestore: companies/{id}/accounting/Data/exchange_rates
   * SQL equivalent: exchangeRate table WHERE companyId = {id}
   */
  getExchangeRatesCollection(companyId: string): SqlCollectionDescriptor {
    return { _type: 'SqlCollection', table: 'exchangeRate', companyId };
  }

  /**
   * Vouchers collection
   * Firestore: companies/{id}/accounting/Data/vouchers
   * SQL equivalent: voucher table WHERE companyId = {id}
   */
  getVouchersCollection(companyId: string): SqlCollectionDescriptor {
    return { _type: 'SqlCollection', table: 'voucher', companyId };
  }

  /**
   * Accounting module settings document
   * Firestore: companies/{id}/accounting/Settings
   * SQL equivalent: companyModuleSettings WHERE companyId={id} AND moduleId='accounting'
   */
  getAccountingSettingsRef(companyId: string): SqlDocumentDescriptor {
    return {
      _type: 'SqlDocument',
      table: 'companyModuleSettings',
      companyId,
      scope: { moduleId: 'accounting' },
    };
  }

  /**
   * Tax categories collection
   * Firestore: companies/{id}/accounting/Settings/taxCategories
   * SQL equivalent: taxCode table WHERE companyId = {id}
   *
   * Note: In the Firestore model this was local to accounting and might be promoted
   * to shared later (see the comment in the Firestore SettingsResolver). In SQL the
   * taxCode table is already shared/global-ish.
   *
   * TODO(275b-audit): CTO — confirm 'taxCode' is the correct Prisma model for tax
   * categories, or whether a separate taxCategory model exists/should exist.
   */
  getTaxCategoriesCollection(companyId: string): SqlCollectionDescriptor {
    return { _type: 'SqlCollection', table: 'taxCode', companyId };
  }

  /**
   * Cost centers collection
   * Firestore: companies/{id}/accounting/Settings/cost_centers
   * SQL equivalent: costCenter table WHERE companyId = {id}
   */
  getCostCentersCollection(companyId: string): SqlCollectionDescriptor {
    return { _type: 'SqlCollection', table: 'costCenter', companyId };
  }
}
