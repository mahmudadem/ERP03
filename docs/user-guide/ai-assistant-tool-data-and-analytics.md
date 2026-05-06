# AI Assistant: Tool Data + Analytics

## What’s New

The AI Assistant can now show structured financial summaries directly in chat for:

- Trial Balance
- Profit & Loss (Income Statement)
- Balance Sheet

It also has a new **Analytics** tab in AI Assistant Settings for admins.

## How to Use Structured Financial Responses

1. Open **AI Assistant → Chat**
2. Ask questions like:
   - “Show me the trial balance”
   - “Give me this month’s profit and loss”
   - “Show balance sheet as of today”
3. The assistant will respond with:
   - normal explanation text
   - a structured data card/table under the message

> Note: AI Assistant remains advisory-only. It cannot post vouchers or edit records.

## How to View AI Usage Analytics (Admin)

1. Open **AI Assistant → Settings**
2. Go to **Analytics** tab
3. Review:
   - Today’s request count
   - Success/failure counts
   - Average latency
   - Total tokens
   - Recent requests table (provider, model, status, tokens, latency)

## Access Requirements

- Chat usage requires: `ai-assistant.chat.use`
- Settings/analytics view requires: `ai-assistant.settings.view`
