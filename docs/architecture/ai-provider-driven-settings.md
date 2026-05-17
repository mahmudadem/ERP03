# AI Provider-driven Settings Architecture

Date: 2026-05-12

## Decision

AI providers are platform metadata records managed by Super Admin. Tenants select providers and models from those records. Tenant API keys remain in tenant AI settings. ERP03-managed AI credentials, subscription credits, limits, and allocation rules belong to a future entitlement engine, not the provider metadata page.

## Data model

```txt
AiProvider
  id
  name
  type
  defaultBaseUrl
  authType
  byok
  enabled
  capabilities

AiModelProfile
  providerId
  modelId
  profileHash
  runtime fields

AiModelCertificationResult
  modelProfileId
  profileHash
  category
  score/maxScore
  status
```

`AiProvider.byok` means:

- `true`: tenant must provide their own key in company AI settings.
- `false`: ERP03 manages the connection elsewhere; future entitlement/credits engine must govern access and usage.

## Tenant-safe endpoints

```txt
GET /tenant/ai-assistant/providers
GET /tenant/ai-assistant/providers/:providerId/models
```

The provider endpoint returns enabled provider metadata only. It never returns provider runtime credentials or secrets.

The model endpoint returns enabled GLOBAL model profiles under the provider and joins valid certification rows when available.

## Super Admin UX notes

- `frontend/src/modules/super-admin/pages/AiProvidersPage.tsx` now applies provider-type defaults for new records.
- The page also shows a recommendation panel describing the suggested base URL, auth mode, and capability flags for the selected provider type.
- The page explicitly warns that AI Credits runtime credentials and future usage caps do not belong to provider metadata. They require a separate platform runtime profile/control surface.

## Runtime safety

- Sensitive ERP tools still require model/profile certification through `AiModelRoutingGuard` and `AiRuntimeGuard`.
- Custom models remain uncertified until company certification exists.
- Legacy/free-text settings remain unverified.
- Certification hash matching remains authoritative.

## Follow-up architecture work

- Move model/profile filtering to repository-level queries if profile count grows.
- Add the future AI entitlement/credits engine before exposing ERP03-managed AI at scale.
- Build deeper ERP scenario certification suites for Accounting, Sales, Purchases, and Inventory.
