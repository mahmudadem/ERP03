# AI Assistant Credits

AI Assistant can be configured to use **AI Credits**.

## What AI Credits Mean

When your company uses AI Credits, ERP03 provides the AI connection for you. You do not need to enter your own provider API key.

Each successful AI chat response uses one credit.

## Runtime Options

- **Bring Your Own Key (BYOK):** your company enters and pays for its own AI provider key.
- **Use AI Credits:** ERP03 provides the AI connection and credits are consumed from your company balance.
- **Off:** AI Assistant is disabled.

## If Credits Run Out

If there are no credits remaining, AI chat in Credits mode will stop and show a clear message. A Super Admin can grant more credits, or the company can switch to BYOK mode.

## What Super Admin Must Configure

Granting credits alone is not enough. Super Admin must also configure the platform AI connection used by Credits mode.

Go to:

`Super Admin -> Platform Global Providers`

For each provider/model you want tenants to use in AI Credits mode, create one runtime entry with:
- provider,
- model,
- platform API key,
- status,
- optional max requests + interval.

If no active runtime entry exists for the selected provider/model, tenant AI chat in Credits mode will fail even if the company has credit balance.

## Typical Setup

1. Super Admin creates or verifies the provider and model catalog.
2. Super Admin opens `Platform Global Providers`.
3. Super Admin creates an active runtime entry for the provider/model and saves the platform API key.
4. Super Admin grants credits to the company.
5. The tenant selects `Use AI Credits` in AI Settings and chooses one of the configured provider/model pairs.

After that, tenant AI chat can run without the tenant entering its own API key.
