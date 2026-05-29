/**
 * FieldLibraryEntry.ts
 *
 * Layer 1 of the three-layer cascade (see planning/tasks/135).
 *
 * One entry per field the system knows how to render and validate.
 * Source of truth for what fields exist, regardless of which voucher
 * type or company form references them.
 *
 * Storage paths (see decision 6.2 in task 135):
 *   system_metadata/field_library/{fieldId}        - super-admin authored, any fieldClass
 *   companies/{companyId}/field_library/{fieldId}  - company-authored, custom_metadata only
 *
 * Resolver order: read both, merge, system wins on id collision. The
 * flat-namespace rule (6.1) is enforced on insert in both tiers.
 */

/**
 * Classifies the field's lifecycle and authoring rights.
 * Mirrors the FieldClass enum in frontend/src/designer-engine/types/FieldDefinition.ts
 * so the data shape is interchangeable across the FE/BE boundary.
 */
export type FieldClass =
  | 'system_core'        // Always mandatory when present on a type. Never demotable per-form.
  | 'system_optional'    // Default available; types/forms can include/exclude.
  | 'computed'           // Read-only; value derived (totals, system metadata, etc.).
  | 'custom_metadata';   // Free-form bag. The only kind companies may author.

/**
 * Renderer-side hint for default placement. Type-level binding (Layer 2)
 * can override this per voucher type (see decision 6.4 — sales_invoice
 * puts warehouse in HEADER, sales_order puts it in LINE).
 */
export type FieldSectionHint = 'HEADER' | 'BODY' | 'EXTRA' | 'FOOTER' | 'ACTIONS';

/**
 * Selector binding metadata. Resolved by the renderer registry — code
 * owns the React component, this struct tells it which collection to
 * query and how to display the rows (decision 6.4).
 *
 * Only `system` fields may carry a selector binding. `custom_metadata`
 * fields are restricted to scalar types (text, number, date, checkbox,
 * simple select) so company-authored fields can't bind to collections
 * the company doesn't control.
 */
export interface SelectorBinding {
  collection: string;        // e.g. 'warehouses', 'parties', 'accounts'
  displayField: string;      // path in the doc used for the label
  valueField?: string;       // defaults to 'id'
  filters?: Record<string, any>;
}

export interface FieldLibraryEntry {
  /** Flat global identity. Unique across BOTH system and company tiers. */
  id: string;

  /** Display label shown in the wizard. Localizable in Phase B. */
  label: string;

  /**
   * Renderer-side type. Mirrors the FieldType union in
   * designer-engine/types/FieldDefinition.ts plus the seed-friendly
   * lowercase aliases the Forms Management page currently uses
   * (`text`, `date`, `select`, etc.). Phase B normalizes to a single
   * canonical set.
   */
  type: string;

  /** Classification — drives mandatory/computed/authoring semantics. */
  fieldClass: FieldClass;

  /** Default placement hint (HEADER, BODY, ...). May be overridden per type. */
  sectionHint?: FieldSectionHint;

  /**
   * Library-level mandatory hint — "when this field appears on a type, it
   * is always required". Distinct from a type's own mandatory flag, which
   * applies per type-binding (Layer 2).
   */
  alwaysMandatory?: boolean;

  /**
   * Library-level shared hint — true means "available to every voucher
   * type by default" (e.g. `date`, `notes`). False means types must
   * opt-in. Currently informational; Phase C wires it.
   */
  alwaysShared?: boolean;

  /**
   * Phase 1A relic from the hardcoded constants. Surfaces the historic
   * supportedTypes / excludedTypes lists so the seeder doesn't lose
   * data. Phase C will migrate these into the Layer 2 type bindings.
   */
  supportedTypes?: string[];
  excludedTypes?: string[];

  /** Renderer binding for selector kinds. Only on `system_*` entries. */
  selectorBinding?: SelectorBinding;

  /**
   * Monotonic version per decision 6.3. Bumps on every meaningful edit
   * (label, type, selectorBinding, validation rule, etc.). Forms persist
   * `fieldVersionsSeen[fieldId]` against this to detect drift on open.
   */
  version: number;

  /** Soft-delete flag. Set when the field is no longer recommended but
   *  still referenced. Strikes through in the wizard catalog. */
  deprecated?: boolean;

  /**
   * Audit metadata.
   * `scope` distinguishes system (super-admin) entries from company
   * (custom_metadata) entries. The repository sets this based on the
   * write path; clients should treat it as informational only.
   */
  scope?: 'system' | 'company';

  /** ISO-8601 strings to keep the entity transport-safe across FE/BE. */
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Shape returned by the resolver: the full merged catalog visible to a
 * given company. Two flat lists (header-eligible vs line/table-eligible)
 * because the wizard step-4 UI splits them visually; the repository
 * derives this split from `sectionHint`.
 */
export interface ResolvedFieldLibrary {
  /** All entries — system + the company's own `custom_metadata` entries. */
  entries: FieldLibraryEntry[];
  /** Subset where `sectionHint === 'BODY'` — wired into the line-items
   *  table column picker in step 4 of the wizard. */
  lineEligible: FieldLibraryEntry[];
  /** Everything else (HEADER / EXTRA / FOOTER / ACTIONS / no-hint). */
  headerEligible: FieldLibraryEntry[];
}
