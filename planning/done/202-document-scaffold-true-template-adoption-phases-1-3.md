# Task 202 — Document Scaffold True Template Adoption (Phases 1–3)

**Date:** 2026-06-10
**Agent:** Claude (Fable 5)
**Branch:** `feat/overpayment-credit-balance`
**Plan:** [tasks/202-document-scaffold-true-template-adoption.md](../tasks/202-document-scaffold-true-template-adoption.md)
**Commits:** `f6ee6ea4` (Phase 1), `a193ddd4` (Phase 2), `fa683ad8` (Phase 3)

## Why

Audit (2026-06-10) confirmed the owner's suspicion: the document template
(`DocumentDetailScaffold`) existed but no page used its named sections — all 8 consumers poured
content through the legacy `children`/`sideRail` escape hatch, the Sales Invoice reference page
never used the template at all, and primitive adoption was wildly uneven. Owner decisions:
fix the template first, pilot on PI, roll out to the rest, rebuild SI last (Phase 4, after
settlement QA); Quotation excluded; keep the legacy escape hatch as convention-not-rule.

## Phase 1 — Template self-parity (`f6ee6ea4`)

Brought `DocumentDetailScaffold.tsx` to parity with the Sales Invoice reference design:

- **`DocumentFooterTotalsStrip` redesigned** to SI's boxed grid strip (bordered slate box,
  per-total label + mono value, tone = value text color). The old pill-chips design looked
  nothing like SI's footer.
- **Footer named slots accept rail-state-aware content** — `content` may be a function of
  `{ showInlineRail, railDrawerOpen }`, replicating SI's "totals only when rail hidden" rule.
- **New `banner` body slot** (first in order) for posted/pending/error banners, plus
  `DocumentStatusBanner` and `DocumentNoticeBanner` primitives matching SI's banner designs.
- **Lines/secondary slot wrappers** gained SI's flex column classes (`flex flex-col`,
  `gap-1.5`) so tables stretch correctly when passed directly as slot content.
- **`DocumentField`** gained SI's lock icon + `select-none` label.
- **Topbar** gained SI's `animate-fade-in`.
- `cardClassName` passthrough for titled slots (needed for `overflow-visible` headers).
- `DocumentSecondaryPanel` simplified to card-only; the slot wrapper now owns region sizing.

Finding recorded: SI's nonstandard shades (`slate-205`, `slate-250`, `blue-650`, …) are **dead
classes** — not defined in the Tailwind theme, silently falling back. The scaffold's standard
classes are the correct cleaned-up rendering; dead classes were deliberately NOT copied.

## Phase 2 — Purchase Invoice pilot (`a193ddd4`)

Both PI mounts (draft/edit + posted view) migrated from `children`/`sideRail` to strict
`sections` / `railSections` / `footerSections`:

- Body: `banner` (pending-approval + error), `control`, `header` (titled slot with
  `cardClassName: 'overflow-visible'`), `lines`, `secondary`, `attachments`, `custom`
  (editable settlement block).
- Rail: `info`, `readiness`, `settlement`, `totals`.
- Footer: rail-state-aware totals (SI behavior) + actions. New locale keys
  `purchases.invoiceDetail.footer.{draftWorking,draftSaved,postedReadonly,pendingApprovalReadonly}`
  in EN/AR/TR.

**Bug fixed by migration:** the legacy path wrapped all rail cards in one `custom` div, so the
rail's `2xl` 4-row grid template (`1.4fr/1fr/1fr/auto`) never applied — cards compressed into
the first row. Named slots render each card as a direct grid child, matching SI.

## Phase 3 — Rollout: SO, DN, SR, PO, GRN, PR (`fa683ad8`)

All remaining consumers migrated to strict named slots; **zero** legacy
`sideRail`/`footerSummary`/`footerActions`/`children` scaffold usage remains in
`frontend/src/modules`. Notables:

- **GRN posted view newly adopted the scaffold** — it was still a plain old page (report 196
  only migrated the draft mount). It now has the standard topbar, rail (info/totals), sticky
  footer with totals strip, and template-styled action buttons.
- **SR and PR headers adopted `DocumentHeaderGrid`** (+ shared header classes for SR),
  removing page-local header grids.
- **SO credit-override dialog and PR unpost dialog moved out of the body flow** to sit with
  the page's other modals (they are fixed overlays; previously they lived inside the scroll
  column).
- Rail cards were mapped to template slots (status→`info`, totals→`totals`), so totals now
  consistently render last in the rail on every document, like SI.

## Follow-up slice — standard rail card interiors (`ea4f26c0`, same day)

Owner QA noticed the SO rail looked different from SI even after Phase 3 (different card
interiors, and SO legitimately hides Settlement/Readiness). Fixed the leftover half: four
interior primitives extracted from the SI rail — `DocumentRailFocus`, `DocumentRailKeyValueList`,
`DocumentRailChecklist`, `DocumentRailTotals` (light rows + dark Grand Total box) — and consumed
by PI, SO, DN, SR, PO, GRN, and PR rail cards. Every Totals card now ends in the SI dark box
(documents without a money total put their key figure there: DN cost base, GRN received qty).
Typecheck + production build green.

**Extra QA step:** open SO/PO/DN/SR/GRN/PR and confirm each rail Totals card now looks like the
SI Totals card (light rows + dark Grand Total box) and status/source cards use the same
key-value row style; sections that do not apply (e.g. Settlement on SO) stay hidden.

## Not done (intentional)

- **Phase 4 — Sales Invoice rebuild** onto the template: waits for settlement/over-payment
  manual QA (report 194) to pass first, per owner decision.
- **Quotation**: stays page-local (owner decision).
- Legacy scaffold props kept (owner decision); documented as legacy-compat only in
  [docs/architecture/document-scaffold.md](../../docs/architecture/document-scaffold.md).
- SO/DN/PO/GRN/PR footer totals remain always-visible (static slot content); only PI adopted
  SI's rail-aware footer behavior so far. Trivial to opt in later.

## Accounting boundary

UI/layout only. No posting, tax, settlement payloads, AP/AR, inventory valuation, COGS,
approval, period-lock, audit, backend DTO, or ledger behavior changed in any phase.

## Verification

- `npm --prefix frontend run typecheck` — passed after each phase.
- `npm --prefix frontend run build` — passed after Phases 2 and 3 (includes `check:reports`,
  `check:no-confirm`, `check:sod-approve`); only pre-existing bundle-size/browserslist warnings.
- Grep sweep: no `sideRail=`, `footerSummary=`, `footerActions=`, `DocumentRailCard`, or
  `DocumentLinesRegion` usage left in `frontend/src/modules`.

## Manual QA script

Run in a fresh template-seeded tenant (SYCO is closed). Test in Classic mode, then repeat
representative pages in Windows mode, then spot-check Arabic/RTL.

1. **Purchase Invoice (pilot — most important).**
   - `Purchases -> Invoices -> New Bill`: confirm order is banner (only if error) → source
     control strip → compact header card → line table → allocation grid placeholder →
     attachments/audit cards → settlement block → sticky footer.
   - Rail shows Info → Posting Readiness → Settlement → Totals, top to bottom.
   - On a wide screen with the rail visible, the footer left side shows the status text
     ("Editing draft purchase invoice."); hide the rail via its round button → footer now
     shows the boxed Subtotal/Tax/Grand strip (Sales Invoice behavior).
   - Open a posted PI: same anatomy read-only; footer status text says posted/locked; hide
     the rail → totals strip appears with Outstanding included.
   - Vendor dropdown in the header must not be clipped by the card edge (overflow check).
2. **Footer totals strip design (all documents).** The footer totals on PI, SO, DN, SR, PO,
   GRN, PR now render as one bordered box with small uppercase labels and mono values —
   visually the same strip as the Sales Invoice footer.
3. **Sales Order.** Header card, promotions (if draft + suggestions), line table, notes card,
   fulfillment + linked documents below. Rail: Order Status first, Order Totals last.
   Trigger the credit-limit override dialog (confirm an order beyond a customer's limit):
   it still opens centered and works.
4. **Delivery Note.** Draft: header card then line table (table hidden when an SO is selected
   but no lines loaded). View: rail shows Source first, Delivery Summary last.
5. **Sales Return.** Create: Return Control strip → header grid → the context-specific lines
   card. View: rail shows Return Control info first, Return Totals last.
6. **Purchase Order.** Header, line table, notes, linked documents; rail Procurement Status
   then Order Totals.
7. **Goods Receipt.** Draft: unchanged anatomy. **Posted/saved view (new):** now uses the
   shared template — topbar with back button + status pill, Info/Totals rail, lines card,
   sticky footer with Lines/Received strip and Back/Edit/Post/Create Return/Unpost actions.
   Confirm Unpost confirmation dialog still appears and works.
8. **Purchase Return.** View/edit: header grid, lines table, totals summary; rail Info →
   Document Status → Totals. Unpost dialog still works.
9. **Rail behavior everywhere.** Hide rail (round button at rail's inner edge), restore from
   the edge button, resize below ~1280px → rail becomes an edge-triggered drawer. In Arabic,
   all of this mirrors to the left edge.
10. **At 2xl width (very wide screen)** the rail cards should fill the column in the SI
    4-row rhythm instead of compressing into the top quarter (this was a real bug fixed by
    the migration).

## Known limitations

- Sales Invoice itself still renders its own shell until Phase 4; small behavioral
  differences between SI and the other 8 pages can persist until then.
- GRN view texts remain hardcoded English (pre-existing; i18n sweep out of scope).
- SO/DN/SR/PO/GRN/PR footers always show totals (no rail-aware status text yet).
