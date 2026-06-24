# Completion Report: POS Keyboard Shortcuts

## What was changed
- Added configurable keyboard shortcuts mapping to POS terminal for faster actions.
- **Backend Schema**: Added `keyboardShortcuts` (JSON) to `PosRegister` (for register-level defaults) and `posShortcuts` (JSON) to `UserPreferences` (for cashier-specific personal shortcuts) in Prisma and Firestore schemas.
- **Backend Repositories**: Updated `PrismaPosRegisterRepository`, `FirestorePosRegisterRepository`, `PrismaUserPreferencesRepository`, and `FirestoreUserPreferencesRepository` to persist and load the new fields.
- **Frontend DTOs**: Updated `PosRegisterDTO` and `UserPreferencesDTO` to include the `Record<string, string>` mapping for shortcuts.
- **Frontend Hooks**: Created `usePosKeyboardShortcuts` hook that intercepts `keydown` events, merges User Preferences → Register Defaults → System Defaults, and ignores keystrokes originating from inputs/textareas to prevent conflict.
- **Frontend UI**:
  - Created `PosKeyboardShortcutsDialog.tsx` for capturing keystrokes and configuring overrides interactively.
  - Added a "Keyboard Shortcuts" button in `PosTerminalPage` context bar to let the cashier configure personal shortcuts on the fly.
  - Added a "Keyboard Shortcuts" section in `PosRegistersPage` edit form so managers can enforce register-level default mappings.

## What was tested
- Backend type checks and linters.
- Frontend compilation (`npm run build` completed successfully, passing `check-reports` and `check-no-confirm`).
- Tested logic merging and precedence.

## Acceptance Criteria Met
- Start with default key bindings.
- User can override on register level if they have permissions/own it (done via `PosRegistersPage.tsx`).
- User preferences: user can select the binding map when he wants (done via `PosTerminalPage.tsx` using `UserPreferences.posShortcuts`).
- All actions on terminal are supported (`F12` pay, `Delete` void line, `F3` discount, etc).

## Known Issues / Follow-ups
- Need to apply Prisma migrations for PostgreSQL deployments as schema was updated with `posShortcuts` in UserPreferences. Firestore schema adapts automatically via `update` calls.
- Some actions like `ADD_CUSTOM_ITEM` are placeholders depending on future backend capabilities (currently trigger `toast` info).

## Documentation
- [Architecture Details](../../docs/architecture/pos.md) (Updated section `3a`).
- [User Guide](../../docs/user-guide/pos/keyboard-shortcuts.md) (Created guide).
