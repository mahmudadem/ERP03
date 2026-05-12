# AI Assistant Credits Runtime Architecture

Phase 1 introduces `CREDITS` as the platform-funded AI runtime mode.

## Runtime Modes

- `BYOK` — tenant provides their own API key.
- `CREDITS` — ERP03/platform provides the AI credential; tenant consumes AI credits.
- `DISABLED` — AI Assistant is disabled for the company.

Legacy persisted `PLATFORM_MANAGED` values are mapped to `CREDITS` inside `AiProviderConfig.fromJSON()`.

## Credit Ledger

Ledger path:

`companies/{companyId}/ai_credit_ledger/current`

The `AiCreditLedger` tracks:
- current balance,
- lifetime purchased/granted credits,
- lifetime consumed credits,
- last debit/credit timestamps.

## Chat Flow

For `CREDITS` mode:
1. `SendChatMessageUseCase` loads the company credit ledger.
2. If no credits are available, the request fails before the provider call.
3. The use case resolves provider `platformRuntimeCredential` from the provider registry.
4. The provider call runs.
5. After a successful chat response, one credit is debited and saved.
6. Provider failures do not consume credits.

## APIs

- Tenant balance: `GET /tenant/ai-assistant/credits`
- Super Admin grant: `POST /platform/ai-assistant/credits/grant`

The grant endpoint is protected by `assertSuperAdmin`. As part of this phase, `assertSuperAdmin` was fixed to enforce the Super Admin role whenever the middleware is applied, including `/platform/*` routes.
