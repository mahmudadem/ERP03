# AI Assistant — "Why does my model show fake numbers?"

## What this page is for

If you ever saw the AI confidently print account balances, transaction lists, or invoice numbers and you knew the numbers were not from your ERP — this page explains why that used to happen, what we changed, and what you'll now see instead.

There are two separate things going on. Both are now fixed.

---

## Story 1: Stale certifications

### What used to happen

1. You picked a model in **AI Settings** (CREDITS mode). The platform team had certified that model for all 12 categories — the modal showed lots of green CERTIFIED chips.
2. Days later the platform team edited the model behind the scenes (a tweak to temperature, a new base URL, a new display name — anything).
3. That edit changed the model's internal fingerprint.
4. The next time you asked an accounting question, the system silently couldn't find a certification that matched the new fingerprint, so it removed your AI's access to ERP tools.
5. Your model then tried to "help" by making up the answer.
6. The Certification Manager **still showed green CERTIFIED chips**, because it was looking at old certificates that had been run on the old fingerprint. There was no visual signal that anything was wrong.

### What you'll see now

In the Certification Manager (Super Admin → AI Models → the model row → "Certifications"), every certificate's `profileHash` is now compared to the model's live fingerprint:

- A certificate whose fingerprint no longer matches gets a **STALE** chip next to its status, and the row is tinted amber.
- When at least one certificate is stale, an amber banner appears above the table: *"This profile was edited after these tests were run, so they no longer apply to the current configuration. Re-run them to re-enable ERP tools."*
- If *every* active certificate has gone stale, the hero card at the top of the modal switches to "Certifications no longer match this profile" instead of the green "Ready" hero — so you cannot accidentally think everything is fine.

### What you'll see in chat

When a model is selected and there is no matching, fresh certification, the runtime warning under each AI message is now specific. It tells you *which* problem exists:

- *"This platform model was updated and needs to be re-certified by the platform team before tools can be used."* — your platform admin (super admin) must re-run the tests.
- *"Your model configuration has changed since it was certified. Re-run certification before using tools."* — you (BYOK) edited your own profile after certifying it. Re-run cert.
- *"Certification for this model is out of date (tool contract / data filter version changed)."* — the platform pushed a new safety contract version and the older certs no longer apply. Either the platform team or you (BYOK) must re-run.
- *"No valid certification exists for this model in this ERP module yet."* — the model was never tested for this module. Test it.

### What different modes mean

There are two ways to use AI in ERP03:

| Mode | Who picks the model? | Who runs the tests? | Who edits the model? | Who sees staleness warnings? |
|------|---------------------|---------------------|----------------------|------------------------------|
| **CREDITS** (platform-managed) | You pick from a list the platform offers. You pay in credits per request. | Platform team. | Platform team. | Platform team — they re-run; you do not have to do anything. |
| **BYOK** (your key) | You add your own API key and your own model. | You. | You. | You — you re-run after every edit you make. |

The new system understands the difference. **CREDITS users are no longer punished for platform-team edits.** Behind the scenes, the system ignores your stored fingerprint for platform-managed models and looks up the latest valid certificate against the live model. If the platform team has already re-run the tests, your chat just works.

If the platform team has **not** re-run the tests yet, your chat sees the `PLATFORM_PROFILE_NEEDS_RECERT` reason and shows you the message above. It's clear it's a platform-side issue, not your fault.

---

## Story 2: Fake tool calls

### What used to happen

Even when the system correctly removed tool access from a model (because no fresh cert existed, or the model was set to text-only), some smaller / cheaper models — qwen, gemma, gpt-oss, etc. — would still emit blocks like this inside their reply:

```
<tool_code>
print(accounting.getLedger({"account_code": "1010101"}))
</tool_code>
<tool_output>
{"opening_balance": 5000.0, "closing_balance": 5750.0, "transactions": [...]}
</tool_output>
```

To you, the chat user, this looked exactly like a real tool response with real numbers. It was not. Those numbers were invented by the model.

### What you'll see now

Two defenses run on every reply.

**1. The model is told, in plain text, that it has no tools.** When the system has removed tool access (text-only model, no certification, AI paused, etc.), the AI's system prompt now contains an explicit block:

> 🚫 NO ERP TOOLS ARE AVAILABLE IN THIS TURN. Do NOT write `<tool_code>`, `<tool_output>`, `<tool_result>`, or any block that looks like a tool call. Do NOT invent account codes, balances, customer names, invoice numbers, or any other business value. Tell the user plainly: "I cannot access your ERP data right now."

Well-behaved models obey. Stubborn ones still try.

**2. The reply is scrubbed before it's saved.** Any block matching `<tool_code>`, `<tool_output>`, `<tool_result>`, `<tool_call>`, `<function_call>`, `<function_response>`, or a fake `print(accounting.something(...))` line is replaced with a visible warning:

> ⚠️ The model attempted to fake a tool call here. The block has been removed because no tool actually ran. Open the relevant ERP module to see real data.

And a second runtime warning appears under the message:

> The selected model tried to fabricate a tool call in this reply. The fabricated section has been removed and any numbers it showed are NOT from your ERP. Pick a certified model in AI Settings.

So even if a misbehaving model gets through defense #1, you immediately see that the answer is fabricated and you should switch models.

---

## What to do when you see the new warnings

| Warning | What to do |
|---------|-----------|
| "STALE" chip on a certification (super admin) | Click "Run all 12 categories" or run the specific category. Tools come back online for tenants on this model. |
| "This platform model was updated and needs to be re-certified by the platform team" (tenant) | Forward this to your super admin / platform team. You cannot fix it yourself. Use a different model in AI Settings in the meantime. |
| "Your model configuration has changed since it was certified" (BYOK) | Open your model in AI Settings → Certifications → re-run the categories you use. |
| "No valid certification exists for this model in this ERP module yet" | Either the platform team or you need to certify it for that category before the AI can use tools there. |
| "The selected model tried to fabricate a tool call in this reply" | Pick a recommended model. The cheaper / free ones (qwen, gemma free, gpt-oss free) often fake; GPT-4o / Claude / Gemini Pro do not. |

## Where to look

- **AI Settings** (your model picker, credit balance, modes): the AI panel inside the ERP shell.
- **Certification Manager** (super admin only): Super Admin → AI Models → click a model → "Manage Certifications".
- **Per-message runtime warnings**: under every AI reply, in the meta strip that also shows the model name.
