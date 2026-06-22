# POS Shortcuts And Control Buttons

## Purpose

POS shortcuts and control buttons let a company configure the cashier terminal without changing posting logic. Product shortcuts are cashier-facing item/group launchers. Control buttons are safe command launchers for terminal actions such as hold, recall, print, reprint, payment dialogs, returns, and shift close navigation.

## Architecture

The backend owns the layout model, validation, scope resolution, and command registry.

- Domain model: `backend/src/domain/pos/entities/PosLayout.ts`
- Repository contract: `backend/src/repository/interfaces/pos/IPosLayoutRepository.ts`
- Firestore repository: `backend/src/infrastructure/firestore/repositories/pos/FirestorePosLayoutRepository.ts`
- Use cases: `backend/src/application/pos/use-cases/PosLayoutUseCases.ts`
- Command registry and executor: `backend/src/application/pos/services/PosCommandRegistry.ts`, `backend/src/application/pos/use-cases/PosCommandUseCases.ts`
- API controller/routes: `backend/src/api/controllers/pos/PosController.ts`, `backend/src/api/routes/pos.routes.ts`
- Frontend API: `frontend/src/api/posApi.ts`
- Runtime UI: `frontend/src/modules/pos/pages/PosTerminalPage.tsx`
- Admin UI: `frontend/src/modules/pos/pages/PosSettingsPage.tsx`

## Data Model

Product shortcut layouts and control button layouts share the same scope model:

- `COMPANY`: tenant-wide layout; may be default.
- `BRANCH`: branch-specific layout; requires `scopeId`.
- `REGISTER`: register-specific layout; requires `scopeId`.
- `USER`: cashier-specific layout; requires `scopeId`.

Runtime resolution priority is:

1. User
2. Register
3. Branch
4. Company default
5. Any active company layout

Product shortcut nodes support:

- `GROUP`: navigational folder; cannot reference an item.
- `ITEM`: sellable shortcut; must reference an item.

Control buttons support fixed zones:

- `TOP_BAR`
- `RIGHT_PANEL`
- `CART_FOOTER`
- `BOTTOM_BAR`
- `MORE_MENU`

## Validation And Controls

The domain layer rejects invalid scope types, missing non-company scope ids, invalid command codes, invalid zones, item nodes without `itemId`, and group nodes with `itemId`.

The layout use case validates shortcut parent structure:

- Parent must belong to the same layout.
- Parent must be a `GROUP`.
- Circular parent chains are rejected.
- Maximum shortcut depth is six levels.

Runtime resolution filters inactive layouts, inactive nodes, hidden buttons, and inactive buttons. Children under inactive parents do not appear because the runtime tree is built only from reachable active root/group nodes.

## Command Registry

Commands are allowlisted in `PosCommandRegistry`. The executor does not run arbitrary frontend-provided scripts. Each command has metadata:

- label and icon defaults
- required permission, if sensitive
- active register/shift/cart prerequisites
- execution mode: `FRONTEND_UI` or `BACKEND_COMMAND`

Sensitive examples:

- `REPRINT_LAST_RECEIPT`: requires `pos.receipt.reprint`
- `OPEN_CASH_DRAWER`: requires `pos.cash.movement`
- `RETURN_REFUND`: requires `pos.return.create`
- `END_SHIFT`: requires `pos.shift.close`

The executor validates the command and permission before the terminal performs local UI work.

## Receipt Print Integration

POS receipt print/reprint now consumes the shared print-layout engine.

- `GET /tenant/pos/receipts/:id` returns receipt, payments, and a POS receipt `printTemplate`.
- `GET /tenant/pos/receipts/:id/print` prepares the original print payload.
- `GET /tenant/pos/receipts/:id/reprint` keeps the existing reprint approval/audit path and also returns the print template.

If a saved default `POS_RECEIPT` template exists, it is returned. Otherwise the response includes a generated default from `PrintLayoutCore`. The backend does not talk to a physical printer driver; terminal/device printing remains a frontend/runtime concern.

## Accounting Impact

This feature does not change posting, tax, COGS, inventory valuation, settlement routing, period locks, or voucher behavior. It changes only terminal configuration, command gating, and receipt print payload preparation. Reprint remains audit-controlled.

## Verification

Focused tests live in `backend/src/tests/application/pos/PosLayoutUseCases.test.ts` and cover layout priority, inactive filtering, graph validation, invalid commands, and sensitive command permission checks.
