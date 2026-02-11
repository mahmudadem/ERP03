# 13 — Recurring Vouchers (Completed)

## Scope
Implemented recurring voucher templates with scheduling, manual generation trigger, pause/resume, and a basic UI to manage templates.

## What was built
- **Domain**: `RecurringVoucherTemplate` entity capturing frequency (monthly/quarterly/annually), day-of-month, start/end, max occurrences, status, nextGenerationDate.
- **Persistence**: Firestore repository; DI wired.
- **Use cases**: Create/Update, Pause/Resume, and `GenerateRecurringVouchersUseCase` that clones source vouchers into new draft vouchers and advances the schedule.
- **API**:  
  - `GET /accounting/recurring-vouchers`  
  - `POST /accounting/recurring-vouchers`  
  - `PUT /accounting/recurring-vouchers/:id`  
  - `POST /accounting/recurring-vouchers/:id/pause`  
  - `POST /accounting/recurring-vouchers/:id/resume`  
  - `POST /accounting/recurring-vouchers/generate` (manual/cron trigger)
- **Frontend**: Recurring Vouchers page to list templates, create, pause/resume, and trigger generation; route added.
- **Tests**: Jest test covers generation and next-date advancement.

## How to use
1) Create a template providing name, sourceVoucherId, frequency, dayOfMonth, start date (optional end/max occurrences).
2) Click “Generate Due Vouchers” (or call the generate endpoint) to create draft vouchers for templates whose `nextGenerationDate` is due.
3) Pause/resume templates as needed; generated vouchers follow normal workflow.

## Notes & assumptions
- Generation produces draft vouchers with `[Recurring]` prefix in description; voucher number left blank for the standard numbering flow to fill.
- Next date advances by 1/3/12 months; clamps day to ≤28 to avoid month-length issues.
- No background scheduler included—`/generate` can be called by cron/worker/login hook.

## Verification
- Automated: `npm test -- --runTestsByPath src/tests/application/accounting/use-cases/GenerateRecurringVouchersUseCase.test.ts`
- Manual (suggested): Create a template for a monthly rent voucher, trigger generation, verify new draft voucher date matches schedule, and that nextGenerationDate advances.
