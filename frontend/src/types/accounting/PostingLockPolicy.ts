/**
 * Posting Lock Policy Enum
 * Mirrors backend PostingLockPolicy for type safety
 */
export enum PostingLockPolicy {
  /**
   * STRICT_LOCKED - Permanent audit lock. No mutations allowed.
   * Vouchers posted under Strict Approval Mode.
   */
  STRICT_LOCKED = 'STRICT_LOCKED',

  /**
   * FLEXIBLE_EDITABLE - Editable even after posting (triggers ledger re-sync).
   * Flexible mode with "Allow Edit Posted" enabled.
   */
  FLEXIBLE_EDITABLE = 'FLEXIBLE_EDITABLE',

  /**
   * FLEXIBLE_LOCKED - Posted but locked by policy (editable if settings change).
   * Flexible mode with "Allow Edit Posted" disabled.
   */
  FLEXIBLE_LOCKED = 'FLEXIBLE_LOCKED'
}
