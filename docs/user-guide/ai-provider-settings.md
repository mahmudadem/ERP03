# AI Provider Settings

## What changed

AI provider setup is now provider-driven. Instead of manually typing everything, company admins can choose from providers and models prepared by the platform administrator.

## How to configure AI

1. Go to **AI Assistant → Settings → Provider**.
2. Choose an AI provider.
3. Choose a model from that provider.
4. If the provider requires your own API key, enter it.
5. Save settings.

## Provider types

- **BYOK providers**: You enter your own API key.
- **ERP03-managed providers**: No key field appears. ERP03 manages the connection. Usage limits/credits will be controlled by future subscription settings.
- **Custom model**: Advanced/manual setup when listed providers do not fit your needs.

## Certified models

Use **Browse Certified Models** to compare models. The table shows certification categories and scores. Current scores may represent structural/connectivity checks; full ERP scenario validation will be expanded later.

## Safety notes

- The AI Assistant cannot directly create, approve, post, or delete ERP records.
- Sensitive ERP tools remain blocked unless the selected model profile is validly certified for that workflow.
- API keys entered by tenants are stored in tenant settings, not in the shared provider definition.
