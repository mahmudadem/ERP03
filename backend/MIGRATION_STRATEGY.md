# STEP 2 Field Classification - Migration Strategy

## Decision: BLOCK Legacy Definitions

For STEP 2 implementation, we are using **BLOCK strategy** rather than automatic migration.

### Rationale

1. **Safety First**: Automatic field classification could misclassify fields, leading to accounting errors
2. **Explicit Intent**: Forces intentional review of each field's posting impact
3. **Clean State**: New system starts with properly classified definitions only
4. **Accountability**: Each classification decision is consciously made

### Implementation

**Schema Version Enforcement**:
- All new VoucherTypeDefinitions MUST have `schemaVersion = 2`
- Loading definitions with `schemaVersion < 2` → REJECTED
- Creating definitions with `schemaVersion < 2` → REJECTED

**Legacy Definitions**:
- Existing definitions without `schemaVersion` property → BLOCKED from loading
- System logs error when legacy definition encountered
- UI shows message: "This voucher type uses legacy schema and must be recreated"

**Recreation Process**:
1. User opens Designer V1
2. Designer enforces field classification UX
3. User must explicitly mark each field as posting/non-posting
4. User must assign postingRole to posting fields
5. System validates before saving
6. New definition saved with `schemaVersion = 2`

### Benefits

- ✅ No risk of misclassification
- ✅ Forced review ensures correctness
- ✅ Clean accounting audit trail
- ✅ No complex migration logic to maintain
- ✅ Clear cutover point

### Migration Path (If Needed Later)

If automatic migration is required in future:
1. Use field ID pattern matching (see implementation plan)
2. Generate classification report
3. Accountant reviews and approves
4. Execute migration script
5. Backup old definitions before migration

**Current Status**: BLOCK strategy implemented via schema version validation.
