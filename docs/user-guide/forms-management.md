# Forms Management

**Where:** Tools → **Forms Management** in each of Accounting, Sales, and Purchases.

This page is the single home for everything related to the *documents* a module produces — invoices, orders, journals, returns, receipts, and so on. The page is identical across all three modules; only the catalog you see changes.

---

## Concepts in one paragraph

A **voucher type** is the business concept ("Sales Invoice"). A **form** is a specific layout/variant of that type that your team will actually use ("Sales Invoice (Direct)", "Sales Invoice (Linked to SO)"). One type can have several forms. Locked default forms ship from the system catalog; you can also clone them or build your own.

---

## Sections of the page

### Installed Types
The voucher types your company has installed. Each type expands to show its forms. Counts at the top of every type row (e.g. *3 forms · 1 active*) tell you at a glance how much is live.

### Available Types
The system catalog items your company hasn't installed yet. Each row has an **Install** button that copies the default form variants into your company.

> **Heads up:** newly installed forms install as *locked* (you can't edit their layout) and *inactive* (they don't show in the sidebar). This is on purpose — flip the green Active toggle when you're ready, or clone first if you want to customise.

---

## Common tasks

### Install a voucher type
1. Find the type in **Available Types** at the bottom.
2. Click **Install**. A toast confirms how many default forms were added.
3. The type now appears in **Installed Types**, collapsed. Expand it to see the variants.

### Activate or deactivate a form
- Flip the green Active toggle on the form row.
- Active forms appear in that module's sidebar; deactivated ones are hidden but not deleted.
- This works on locked default forms — activation is a company preference, not a layout change.

### Clone a locked default to customise it
1. Click the **`+`** (Clone) icon on the form's row.
2. The form wizard opens at *Basic Info*. The **ID Key** and **Prefix** are pre-filled with suggested values — feel free to override either. Both are checked for uniqueness inside your company.
3. Walk the wizard's steps (Rules / Fields / Actions / Visual Editor / Review). Save.
4. Your clone appears in the same type's list, unlocked and ready for further edits.

### Add a custom form from scratch
1. Expand a type → click **+ Add Custom Form** at the bottom of its list.
2. Same flow as Clone — suggested ID with an `_N` suffix and a `N-` prefix.

### Move a form to a different sidebar group
1. Click the **`⋮`** (kebab) icon on the form's row → **Sidebar Group**.
2. Pick one of the preset chips — **Documents · Vouchers · Reports · Operations** — or type a custom name (e.g. "Approvals", "POS") and press Enter.
3. The sidebar refreshes immediately and the form moves into that submenu.
4. A purple `📂 {group}` badge appears on the row so you can see at a glance where the form lives.

> **Tip:** the four preset chips are the buckets that already exist as canonical sidebar groups in every module. Anything else you type becomes its own new top-level submenu.
>
> **Locked default forms can be re-grouped freely.** Sidebar Group is a preference, not a design change, so the "Cannot edit locked form. Clone it instead." rule does not apply here.

### Export a form as JSON
- Kebab → **Export JSON** downloads the form's full config (`voucher_form_{id}.json`). Use it for backups, moving customisations between companies, or attaching to support requests.

### View Schema (coming soon)
- This option is a placeholder for an upcoming read-only schema viewer.

---

## The in-page walkthrough

Next to the page title there's a **`?`** icon. Click it for a slide-over panel that explains every section of this page with examples and tips. The walkthrough lives there permanently — open it whenever you forget what something does.

---

## Why some forms can't be edited

System default forms are **locked**. Their layout, fields, and rules can't be changed because the accounting engine and other modules rely on a stable shape. You can always:

- **Toggle them on/off** (organisational preference).
- **Re-group them** (organisational preference).
- **Clone them** and edit the clone freely (the lock disappears on the copy).

If you ever try to change a locked form's design directly you'll see: *"Cannot edit locked form. Clone it instead."* — that's the same protection in action.

---

## Frequently confused

- **Type vs. Form** — the type is "what kind of document" (Sales Invoice); the form is "which layout of that document" (Direct, Linked, Service). One type, many forms.
- **Locked vs. Inactive** — *locked* means you can't change the design; *inactive* means it's not in the sidebar. A form can be locked-and-active (a default you're using as-is) or unlocked-and-inactive (a custom variant you haven't published yet).
- **Custom sidebar groups** — anything you type beyond the preset chips becomes a new top-level submenu in that module's sidebar. There's no separate "manage sidebar groups" page — assign a form to a group and the group exists.
