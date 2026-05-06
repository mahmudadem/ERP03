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

## How to Use It

1. Open **AI Assistant → Chat**.
2. Ask a question about your ERP data.
3. If the assistant can answer safely, it replies in chat.
4. If it needs more information, provide the requested details.
5. If it creates a proposal, open the proposal card to review details.

## AI Proposals

AI proposals are sandbox suggestions. They are useful for drafts, corrections, mappings, reorder suggestions, and management insights.

Important safety note:
- Reviewing or accepting a proposal does **not** create real ERP records.
- It does **not** post vouchers.
- It does **not** execute any business action.

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
