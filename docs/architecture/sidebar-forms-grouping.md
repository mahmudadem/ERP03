# Sidebar Forms Grouping Policy

> Where each kind of form/voucher lives in the module sidebar, by module.
> This is the **single source of truth** for the grouping behavior. The runtime
> implementation lives in [`frontend/src/hooks/useSidebarConfig.ts`](../../frontend/src/hooks/useSidebarConfig.ts)
> (`buildDynamicFormGroups`) and the seed data lives in
> [`backend/src/seeder/seedSystemVoucherTypes.ts`](../../backend/src/seeder/seedSystemVoucherTypes.ts).

---

## Vocabulary (use these terms exactly)

- **Native form** — a hard-coded sidebar entry declared in
  [`frontend/src/config/moduleMenuMap.ts`](../../frontend/src/config/moduleMenuMap.ts).
  Examples: Sales → Quotations, Sales → Sales Orders, Accounting → Approval
  Center, Accounting → All Vouchers. These are part of the application shell;
  they always exist and are never installed/cloned.
- **Default form** (a.k.a. *system default*, *locked default*) — a form copied
  into the company catalog from the system seed when the user installs a
  voucher type. `isLocked: true`, `isDefault: true`. Layout/fields cannot be
  edited; can be activated, deactivated, re-grouped, or cloned.
- **Cloned / custom form** — an editable form created by the user, either by
  cloning a default or starting from scratch. `isLocked: false`.

These three are mutually exclusive. Every sidebar entry produced by the forms
system is exactly one of them.

---

## Target policy — per module

The defaulting rule for **where a form lands when nothing else says
otherwise**. Users can always override via the row's *Sidebar Group* picker
(see [forms-management.md](../user-guide/forms-management.md)).

### Accounting

Accounting does not have a "Forms" concept — it has **Vouchers**. The whole
forms machinery exists, but the user-facing label is *Vouchers* everywhere in
this module. There is no static `Forms` group in the accounting sidebar.

| Form kind        | Default sidebar location                                     |
| ---------------- | ------------------------------------------------------------ |
| Approval Center  | **Root** of accounting sidebar (top-level item)              |
| All Vouchers     | First entry inside the **Vouchers** group (dynamically prepended) |
| Default voucher  | **Vouchers** group — visible, not suppressed                 |
| Cloned/custom    | **Vouchers** group (same as defaults, unless user picks another) |

Rationale: in accounting, a "default voucher" *is* the voucher the company will
use day-to-day (Payment Voucher, Receipt Voucher, Journal Entry…). Hiding
them behind *Tools → Forms Management* — the v1 behavior — leaves the
accounting sidebar effectively empty for a fresh tenant. They must be reachable
directly as Vouchers.

### Sales / Purchases (and any future doc-bearing module)

These modules have a real distinction between native list pages
(Quotations, Sales Orders, Sales Invoices…), the default forms shipped by
the system, and user clones.

| Form kind     | Default sidebar location                              |
| ------------- | ----------------------------------------------------- |
| Native        | **Forms** group (hard-coded in moduleMenuMap)         |
| Default       | **Default Forms** group                               |
| Cloned/custom | **Root of the module sidebar** (top-level item), unless the user assigns a group via the Sidebar Group picker |

Rationale: clones are the user's own forms; they should sit at the level the
user expects to find them — directly under the module, not nested two levels
deep. Power users who want them organized can always assign a group.

---

## Implementation (2026-05-30)

The runtime defaults described in the **Target policy** above are implemented
in [`frontend/src/hooks/useSidebarConfig.ts`](../../frontend/src/hooks/useSidebarConfig.ts)
inside `buildDynamicFormGroups`. The function computes an effective sidebar
group per form via:

```
explicit sidebarGroup (not "Documents")  → use it verbatim
module === 'accounting'                  → "Vouchers"
isSystemDefaultForm                      → "Default Forms"
otherwise (clone, no group)              → null  // emitted at module root
```

Notes on the implementation:

- The literal `"Documents"` value is treated as **unset**, because the seed
  ([`seedSystemVoucherTypes.ts`](../../backend/src/seeder/seedSystemVoucherTypes.ts))
  writes `sidebarGroup: "Documents"` for every voucher type regardless of
  module. The runtime override means we can ship the per-module defaults
  without a data migration. If a user wants a "Documents" group in the future,
  the seed should pick a non-colliding placeholder (e.g. `null`) and the
  preset chip list in
  [`FormCard.tsx`](../../frontend/src/modules/tools/forms-designer/components/FormCard.tsx)
  can be relaxed.
- Default-form suppression (the v1 behavior) has been removed.
- Groupless clones are emitted as top-level `SidebarItem` leaves (no children)
  and slot between *Default Forms* and *Vouchers* in module-section order via
  `ROOT_LEAF_RANK`.
- The legacy dynamic prepend of "All Vouchers" inside the Vouchers group is
  gone — accounting already has it as a hard-coded entry in the static **Forms**
  group of `moduleMenuMap.ts`.

## Follow-ups (not blocking)

- Update [`seedSystemVoucherTypes.ts`](../../backend/src/seeder/seedSystemVoucherTypes.ts)
  to emit per-module defaults instead of the global `"Documents"` placeholder,
  so the backend-stored value matches the runtime intent. Cosmetic until/unless
  another consumer (a reporting query, a CSV export, etc.) reads
  `sidebarGroup` directly.
- Decide whether to remove `"Documents"` from the preset chips in
  [`FormCard.tsx`](../../frontend/src/modules/tools/forms-designer/components/FormCard.tsx)
  given the runtime treats it as unset.

---

## Doc cross-references

- User-facing concept doc: [docs/user-guide/forms-management.md](../user-guide/forms-management.md)
- Engine plan: [docs/architecture/document-forms-plan.md](./document-forms-plan.md)
- Sidebar runtime code: [frontend/src/hooks/useSidebarConfig.ts](../../frontend/src/hooks/useSidebarConfig.ts)
- Seed data: [backend/src/seeder/seedSystemVoucherTypes.ts](../../backend/src/seeder/seedSystemVoucherTypes.ts)
- Module menu (native forms): [frontend/src/config/moduleMenuMap.ts](../../frontend/src/config/moduleMenuMap.ts)
