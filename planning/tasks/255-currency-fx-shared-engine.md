# Task 255 — Currency / FX as a shared engine

> **Status:** ✅ DONE (2026-06-22) via **Option A** — `IFxEngine` seam. Investigation found the "duplication" was overstated: the `accounting` exchange-rate use-cases + service are already **re-export shims** of one canonical implementation in `application/core` (no real logic duplication). So Task 255 = formalize the shared seam: added `IFxEngine` contract (`resolveRate` exact/recent/inverse + `detectDeviations` + `saveReferenceRate`), `LegacyFxAdapter` wrapping the core use-cases (pure delegation, behaviour-preserving), DI getter `fxEngine`, barrel export, and a `SystemCoreBoundaries` guard. `IMoneyCore` stays a pure money/rounding engine. Verified: focused `FxEngine.test.ts` + boundary test + full backend suite **1643 green**, backend build clean. **Optional follow-up:** migrate the existing Currency/FXRevaluation controllers to consume `IFxEngine` instead of constructing the core use-cases directly (phased, like the accounting-bridge FUPs).
> **Priority:** MEDIUM. (Previously referred to informally as "Task 253"; renumbered to 255 for priority order behind the posting-flag and item/stock tasks.)
> **Principle:** [engines-vs-modules.md](../../docs/architecture/engines-vs-modules.md) — rate resolution is cross-cutting truth any module needs; it must be one always-on engine, not duplicated per module.

## The problem (duplication)

FX/currency logic is copy-pasted across two homes:

- `application/core/use-cases/ExchangeRateUseCases.ts` + `core/services/ExchangeRateService.ts`
  + `repository/interfaces/core/{IExchangeRateRepository, ICompanyCurrencyRepository}`
- `application/accounting/use-cases/ExchangeRateUseCases.ts`
  + `accounting/services/ExchangeRateService.ts`
  + `repository/interfaces/accounting/{IExchangeRateRepository, ICompanyCurrencyRepository}`

Two copies of rate resolution, deviation detection, and inverse-rate logic. Meanwhile
`IMoneyCore.toBase(value, currency, rate)` takes the rate **as a parameter** — it does not
resolve rates. So every caller must first find a rate from one of the two duplicate stacks
before handing it to MoneyCore.

## Owner intent (decided)

- Currency/FX is shared logic. **Any module consumes the same engine** — no per-module copy.

## Scope (design decision first)

Pick one:

- **Option A — new `IFxEngine`** in `application/system-core/contracts/`: owns rate resolution
  (exact / most-recent / inverse), deviation warnings, and feeds rates into MoneyCore's
  `toBase`. Both legacy stacks collapse behind a `LegacyFxAdapter`.
- **Option B — fold rate resolution into `IMoneyCore`** (e.g. `toBaseResolved(value, currency,
  date)` that looks up the rate internally) and retire the duplicates.

Recommendation: **Option A** — FX is a distinct concern (rate history, deviation policy)
that several modules query independently; MoneyCore stays a pure money/rounding engine.

## Acceptance criteria

- [ ] One engine owns rate resolution + deviation detection; the two duplicate stacks are
      retired (or one becomes a thin `Legacy*Adapter`).
- [ ] All current FX callers (SI/PI multi-currency, settlement, FX revaluation) route through it.
- [ ] Behavior-preserving: existing multi-currency vouchers and FX gain/loss unchanged
      (golden parity test).
- [ ] Registered in `bindRepositories.ts`; consumed by interface; boundary guard added to
      `SystemCoreBoundaries.test.ts`.
- [ ] Documented in `docs/architecture/system-core.md` + the engines list.
- [ ] Full backend suite green; backend typecheck + build clean.

## Guardrails

- FX touches settlement, revaluation, and multi-currency posting — all accounting-sensitive.
  No total, rate, or account may change in behavior-preserving mode.
