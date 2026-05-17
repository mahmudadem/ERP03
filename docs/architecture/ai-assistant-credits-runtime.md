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
3. The use case resolves a platform runtime profile for the selected provider and global model profile.
4. The runtime profile supplies the encrypted platform API credential and request-cap policy for that provider/model pair.
5. If no runtime profile exists, the resolver may fall back to the legacy provider-level `platformRuntimeCredential` for backward compatibility.
6. The provider call runs.
7. After a successful chat response, one credit is debited and saved.
8. After a successful chat response, the runtime profile usage window and total-success counters are incremented.
9. Provider failures do not consume credits.

## Platform Runtime Profiles

Credits mode now uses a dedicated runtime registry instead of relying only on provider metadata.

Runtime profile identity:
- `providerId`
- `modelProfileId`

Stored runtime data:
- encrypted platform API key,
- credential hint/masked suffix,
- runtime status (`active`, `paused`, `disabled`),
- max requests per interval,
- interval type (`minute`, `hour`, `day`, `month`),
- current usage window counters,
- lifetime successful request count,
- last-used / last-failure metadata.

The registry is stored in Firestore at:

`system_metadata/ai_runtime_profiles/items/{providerId}__{modelProfileId}`

Operational rule:
- tenant AI settings still choose provider + model in the normal AI settings flow,
- `CREDITS` mode resolves the matching platform runtime profile at execution time,
- the runtime profile is authoritative for platform credential availability and request-cap enforcement.

This keeps:
- provider registry = metadata/catalog,
- model registry = certified model catalog,
- runtime profile registry = platform-funded execution control.

## APIs

- Tenant balance: `GET /tenant/ai-assistant/credits`
- Super Admin grant: `POST /platform/ai-assistant/credits/grant`
- Super Admin runtime profiles:
  - `GET /platform/ai-runtime-profiles`
  - `POST /platform/ai-runtime-profiles`
  - `GET /platform/ai-runtime-profiles/:profileId`
  - `PATCH /platform/ai-runtime-profiles/:profileId`
  - `DELETE /platform/ai-runtime-profiles/:profileId`

The grant endpoint is protected by `assertSuperAdmin`. As part of this phase, `assertSuperAdmin` was fixed to enforce the Super Admin role whenever the middleware is applied, including `/platform/*` routes.

## Super Admin UI

Runtime profiles are managed from:

`/super-admin/platform-global-providers`

This page allows Super Admin to:
- choose provider,
- choose a global certified model,
- store the platform API key,
- activate/pause/disable the runtime,
- set request caps by interval.
