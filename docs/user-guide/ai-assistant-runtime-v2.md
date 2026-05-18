# AI Assistant Runtime v2 — User Guide

## What’s New

The AI Assistant now gives clearer feedback about how it is answering your questions.

You may see:
- the model/provider being used,
- a warning if the model is custom or untested,
- text-only mode when tools are not available,
- a message that safe tools are being checked,
- a clarification card when more information is needed,
- an AI Proposal card when a draft proposal is created.

## How Tool Planning Works

When you ask about ERP data, the assistant checks likely tool hints first, then decides which safe read-only ERP tools it needs.

For example, if you ask:

`Show account statement for Cash`

the assistant may first look for the account, then use the account statement tool with the correct account code.

If you ask something broad or unclear, such as:

`Show invoice for Adam`

and there is more than one possible meaning, the assistant should ask a clarification instead of guessing.

## Follow-Up Questions

The assistant should treat chat as one continuous conversation.

If you ask for a report, then ask a follow-up like "explain that account" or "say it in Arabic", the assistant should first use the conversation history and any ERP data it already fetched.

It should not ask you again for information that is already available in the same chat. If the previous data is enough, it should answer from that data. If more ERP data is needed, it should use safe read-only tools. If your intent is unclear, it should ask a short clarification before answering.

## Controlling Context Cost

Company admins can control how much previous conversation context is sent to the AI model from **AI Assistant -> Settings -> Provider**.

Options:
- **Minimal**: lowest token use, shorter memory.
- **Balanced**: recommended default for normal use.
- **Deep**: better continuity in long conversations, higher token use.

There is also an **Include previous tool results** option. When it is on, follow-up questions can reuse ERP data already fetched in the same chat. When it is off, the assistant sends less previous ERP data to the model, which can lower token usage.

If context was limited to control cost, the chat may show a warning. In that case, ask for the specific report or account again if the assistant needs details that were trimmed.

## How to Use It

1. Open **AI Assistant → Chat**.
2. Ask a question about your ERP data.
3. If the assistant needs data, it may use safe read-only tools.
4. If it needs more information, provide the requested details.
5. If it creates a proposal, open the proposal card to review details.

## AI Proposals

AI proposals are sandbox suggestions. They are useful for drafts, corrections, mappings, reorder suggestions, and management insights.

Important safety note:
- Reviewing or accepting a proposal does **not** create real ERP records.
- It does **not** post vouchers.
- It does **not** execute any business action.

## What the Assistant Still Cannot Do

- It cannot create, modify, approve, post, or delete records.
- It cannot guess balances, invoices, stock quantities, or financial figures.
- It cannot bypass permissions.
- It cannot use data outside your company context.

## Super Admin Policy Page

Super Admins can manage AI Proposal policies from the platform area.

They can:
- enable/disable the proposal system,
- require review,
- set daily limits,
- disable specific proposal types,
- view summary counts.

The business execution setting is locked off. AI proposals cannot be turned into direct automatic execution in this version.

## Permissions

- Chat requires AI Assistant chat permission.
- Proposal review pages require AI Proposal permissions.
- Policy management is Super Admin/platform-level only.

## Testing a Model in Settings

Company admins can open **AI Assistant → Settings → Provider** and run **Model diagnostics** after saving provider settings.

The test shows:
- whether the provider connection works,
- whether the model can answer a simple prompt,
- whether the model supports native tool calling,
- whether the safer text-plan fallback works,
- the recommended mode for this model.

If you change the provider, endpoint, API key, or model, save the settings first and then run diagnostics again. The test uses safe prompts only and does not send ERP business data.

## Super Admin Model Profiles

Super Admins can manage AI model profiles from:

**Super Admin -> AI Models**

This page controls how the system treats each provider/model in chat.

Super Admins can:

- add a new model profile;
- edit model status;
- mark whether native tool calling is supported;
- mark whether structured JSON is supported;
- turn text-only mode on or off;
- add tags and recommended use cases;
- add warning messages;
- delete model profiles;
- sync the built-in default profiles into the editable catalog;
- run diagnostics for a model profile using one company's saved AI provider settings.

Model diagnostics and model approval are related but separate:

- Diagnostics checks whether the saved model can connect, respond, and use tools.
- The Super Admin model profile controls whether chat shows the model as tested, experimental, custom, text-only, or blocked.

So if a new model passes diagnostics but still appears as untested in chat, open **Super Admin -> AI Models**, create or edit that model profile, then set the correct status and capabilities.

When running diagnostics from Super Admin, choose the company whose AI settings should be used. The test uses that company's saved provider endpoint/API key internally, but the API key is not displayed.

## Certified Model Safety

ERP tool access now requires a certified model profile on the backend.

Diagnostics are useful, but diagnostics do not certify a model. Passing diagnostics only means the provider key, endpoint, model response, JSON behavior, or tool-call behavior can be tested. It does not mean the model is approved for Accounting, Finance, Sales, Inventory, or other ERP workflows.

Older company AI settings that only contain a typed provider/model name are treated as legacy and unverified. They may still be useful for basic chat, but sensitive ERP tools are blocked until a certified model profile is selected or company certification is added.

If the selected provider, endpoint, model, or runtime settings change, the system treats it as a different runtime profile. Previous certification no longer applies until the new profile is certified.

The next UI increment will add the Recommended Certified Models selection flow and company custom model certification flow.

## Certification Workflows

The backend now supports certification records for AI model profiles.

Super Admins can certify global model profiles. Company Admins can create company-only custom model profiles and run company certification for them.

Certification is tied to the exact selected profile and profile hash. If the provider, endpoint, model, or runtime settings change, the previous certification no longer applies.

The current certification engine is an initial shell. It performs structural safety checks and supports manual certification records. Full automated ERP behavior tests will be added later.

### Certification Pre-Flight Diagnostics

When you trigger model certification, the system proactively runs a lightweight pre-flight health diagnostic before running the extensive behavioral tests. This diagnostic verifies that the AI provider is fully reachable and responsive.

If the diagnostic fails (for example, due to a missing/invalid API key, incorrect provider base URL, or server outage), the certification halts early and reports the exact diagnostic error in the certification summary (e.g., `"Certification incomplete. Pre-flight diagnostic: Provider is reachable but inference failed: API key invalid."`).

This prevents you from waiting for a full test suite to finish when the provider configuration is incorrect, giving you clear, immediate steps to resolve the issue.

## Account Balance Tool Results

When you ask the AI Assistant for the balance of a specific account, include the account code when possible.

Example:

```text
Show me the balance for account 1010101
```

If the account is found, the assistant shows a data card with:

- balance,
- total debit,
- total credit,
- account code,
- account name,
- account classification.

If the account cannot be found or the assistant did not send enough information to the tool, the card shows the reason instead of a generic failure.
