# Setting up AI — Super Admin guide

> **Plain-language walkthrough of the AI setup flow on the Super Admin side.**
> Written for the non-technical product owner. Re-readable at 2 AM.

---

## The big picture (60 seconds)

To let tenants use AI, you set up **five things in order**:

```
1. Provider     →  who hosts the model?            e.g. OpenAI, OpenRouter
2. Model        →  which specific model?           e.g. claude-sonnet-4.6
3. Platform Key →  your API key + spending budget  so platform can call it
4. Test         →  does it actually work?          live diagnostic
5. Certify      →  approved for which ERP areas?   e.g. Accounting, Sales
```

Once all five are done, tenants on the **credits mode** can use this model immediately.

**Best way to do this:** Super Admin → AI Management Overview → click the big **"Set up a new AI model"** card. It walks you through all five steps in order. Each step saves immediately, so you can leave and come back.

If you prefer to edit one thing at a time (already-set-up models), use the underlying pages directly: AI Providers, AI Models, Platform Global Providers. The wizard just bundles them.

---

## The API Key Vault (Step 0 — recommended)

Before you start the wizard, save your provider API keys in the **API Key Vault** at `Super Admin → AI API Keys`. The vault is a single place where you:

- Save and **label** every API key you use (one per provider — OpenRouter, OpenAI, Anthropic, etc.)
- See a **validation badge** next to each (green Valid / red Invalid / gray Not tested)
- Click **Test** to verify the key still works against the provider's `/models` endpoint
- **Rotate** a key in one place (vs. updating it inside every runtime profile that uses it)

**Why use it:** without the vault, the same OpenRouter key gets pasted into every runtime profile (one per model). With the vault, you save it once, validate it once, and **pick from a list** in the wizard's Step 3 or in the Runtime Profiles page.

**How keys flow** when you pick from the vault:
1. You select a vault key in the UI → only the **key id** travels to the backend.
2. The backend looks up the vault, **decrypts** the key server-side, and stores it in the runtime profile's encrypted credential.
3. Cert / diagnostics / runtime continue to read the runtime profile's own credential — they don't re-dereference the vault on every request.
4. If you rotate the vault key, existing runtime profiles keep working with their stored copy — re-pick the vault key on a runtime profile to push the new value down.

---

## Step 1 — Provider

A **provider** is the company hosting the AI: OpenAI, OpenRouter, Anthropic, Google, etc.

You only need to register a provider **once**. After that, every model on that provider reuses it.

**What you fill in:**
- **Name** — what you call it (e.g. "OpenRouter")
- **Type** — picks the API protocol (`openai_compatible` for OpenRouter and most third parties; `openai` only for the real openai.com; `anthropic` for the real anthropic.com; `ollama` for local)
- **Base URL** — auto-fills from the type, override if you need to

**No API key here.** Keys are saved per-model in Step 3.

---

## Step 2 — Model

The specific model on that provider.

**What you fill in:**
- **Model ID** — the exact string the provider expects, like `anthropic/claude-sonnet-4.6` or `gpt-4o`. Get it from the provider's docs.
- **Display name** — optional friendly label
- **Max context tokens** — how big a prompt the model accepts
- **Supports tool calling** — check if the model can invoke ERP tools (function calling). Most modern paid models can.

Status defaults to `experimental` — it stays that way until certified.

---

## Step 3 — Platform Key

This is **your** API key for the provider, used when tenants run on **platform credits mode** (you pay; tenants spend credits).

You have two ways to provide the key:

**A. Pick from vault (recommended)** — toggle is auto-selected if you have saved keys for the chosen provider. Click the key card and continue.

**B. Paste a new key** — toggle switches to a password field. There's an inline "**+ Also save this key to the vault**" link that creates a vault entry in one click so you can reuse it on other models.

**Other fields:**
- **Max requests per interval** — budget cap so a runaway loop can't drain you. Pick a number that's high enough for normal use but low enough to catch abuse.
- **Interval** — `day` is usually right. `minute`/`hour` only for high-volume models.

**The key is encrypted at rest** — once saved, it's never displayed back. To rotate, either update the vault entry (and re-pick it on each runtime profile), or paste a new key directly here.

> ⚠️ **The most common setup mistake** is saving the wrong key here. Always run Step 4 (Test) right after to catch it before tenants do.

---

## Step 4 — Test

Click **"Run diagnostics"**. It does four checks live:

1. **Provider connection** — can we reach the API at all? (calls `GET /models`)
2. **Model response** — can the model generate text? (sends a 1-token "Reply: ok" prompt)
3. **Native tool calling** — does function-calling work? (sends a tiny test tool)
4. **Guarded text-plan fallback** — if native tool calling failed, can the model still emit a structured plan in text? Some providers (like OpenRouter for some models) need this fallback.

**What pass means:**
- Steps 1 & 2 must pass for the model to be usable at all.
- At least one of steps 3 or 4 must pass for ERP tool features (proposals, automation) to work. If both fail, the model is text-only.

**If something fails:** the error message names the actual cause — `Insufficient credits`, `Forbidden — API key lacks model access`, `Model not found`, etc. Fix the issue (top up, change models, etc.) and re-run.

---

## Step 5 — Certify

Certification declares: **"This model is approved to use ERP tools for this category."**

The system blocks tool access until a model is certified for the relevant category. So if a tenant asks the AI to "create a journal entry" and the model isn't certified for `ACCOUNTING`, the AI runtime refuses.

Pick a category and click **Certify**:

| Category | What it unlocks |
|---|---|
| `GENERAL_CHAT` | Basic chat — no ERP data access |
| `ACCOUNTING` | Journal entry tools, ledger reads |
| `SALES` | Sales invoice/quote tools |
| `PURCHASES` | Purchase order tools |
| `INVENTORY` | Stock movement tools |
| `FINANCE_REPORTING` | Read-only financial reports |
| `HR`, `CRM` | HR/CRM module tools |
| `TOOL_CALLING` | A meta-cert that allows any tool calls |
| `DATA_FILTERING` | Model can apply PII/sensitive data masking |
| `PROPOSAL_DRAFT` | Can draft proposals (sales, etc.) |
| `ANALYTICS` | Can compute and explain metrics |

Certify the categories you want tenants to use. You can come back and certify more later.

---

## What "certified" means in practice

Certification is keyed to the model's **profile hash** — a checksum of the model + provider + runtime config (temperature, policies, etc.). If you edit the model and change the temperature, the hash changes, and **the certification becomes invalid until you re-certify**.

This is intentional: it forces a re-test if the model behaves differently after a config change.

---

## Resetting / starting over

If a model has bad certification records (failed runs you want to clear), open the cert manager from the AI Model Profiles page and click **"Reset certification history"**. This wipes all cert records for that model without deleting the model itself.

To fully delete a model: just delete the model from AI Model Profiles. Certifications cascade-delete with it (no more zombie records reappearing).

---

## Common failure patterns

| Symptom | Likely cause | Where to fix |
|---|---|---|
| Diagnostics: `Provider connection failed` | Wrong base URL, or provider service down | Step 1 — provider config |
| Diagnostics: `Authentication failed — check your API key` | Wrong key in Step 3 | Step 3 — paste correct key |
| Diagnostics: `API key valid, but not authorized for this specific model` | Provider account doesn't have access to that model (free tier, BYOK not configured, etc.) | Fix in the provider's dashboard (OpenRouter, OpenAI, etc.) |
| Certification: `No active platform runtime profile` | Skipped Step 3 | Step 3 — create the runtime profile |
| Diagnostics passes but certification fails | Model rejects the structural test (no tool calling, etc.) | Try a different category, or pick a more capable model |

---

## Quick reference — what each step writes to the database

| Step | Entity | Backend repository |
|---|---|---|
| 0. Vault (optional, before wizard) | `AiPlatformApiKey` | `aiPlatformApiKeyRepository` |
| 1. Provider | `AiProvider` | `aiProviderRepository` |
| 2. Model | `AiModelProfile` (scope=GLOBAL) | `aiModelProfileRepository` |
| 3. Platform Key | `AiPlatformRuntimeProfile` (status=active) — credential sourced from vault if `apiKeyId` is sent, else from inline `apiKey` | `aiPlatformRuntimeProfileRepository` |
| 4. Test | — (no write, just runs diagnostics) | — |
| 5. Certify | `AiModelCertificationResult` | `aiModelCertificationRepository` |

Tenant-side AI settings live in a separate `AiProviderConfig` per tenant — not touched by Super Admin setup.

---

## "Run all categories" — Step 5

Step 5 has two buttons:
- **Certify** — runs the currently selected category and reports back.
- **Run all categories** — loops through all 12 categories sequentially. Confirms first (can take a few minutes), then shows live per-category status (running → passed / failed). On finish: "Done — N of 12 categories certified".

Use the second button when onboarding a new model — it gives you a complete picture of which ERP areas the model is approved for in one shot.

---

## Resetting / starting over (revisited)

If a model has bad certification records (failed runs you want to clear), open the cert manager from the AI Model Profiles page and click **"Reset certification history"**. This wipes all cert records for that model without deleting the model itself.

To fully delete a model: just delete the model from AI Model Profiles. Certifications **cascade-delete** with it — no more zombie records reappearing when you recreate a profile with the same hash.

---

## Where everything lives at a glance

| Page | Path | Purpose |
|---|---|---|
| **AI Setup Wizard** | `/super-admin/ai-setup` | The guided flow — start here for new models |
| **AI Overview** | `/super-admin/ai-management` | System-wide stats + entry point to the wizard |
| **API Key Vault** | `/super-admin/ai-api-keys` | Manage your provider API keys |
| **AI Providers** | `/super-admin/ai-providers` | Provider CRUD (edit existing) |
| **AI Models** | `/super-admin/ai-models` | Model profile CRUD + Cert Manager modal |
| **Platform Global Providers** | `/super-admin/ai-runtime-profiles` | Runtime profile CRUD (edit existing) |
| **AI Proposal Policies** | `/super-admin/ai-proposal-policies` | Governance rules per module |
