# AI Assistant Safety Improvements

AI Assistant now includes extra safety checks.

## Safer ERP Data Handling

When AI Assistant reads ERP data through tools, the system cleans suspicious instruction-like text before sending it to the AI model. This helps prevent malicious customer names, notes, or account descriptions from changing the assistant’s behavior.

## Duplicate Message Protection

If you send two messages too quickly in the same conversation, the second request may be blocked with a message asking you to wait. This prevents duplicate AI responses and reduces accidental extra processing.
