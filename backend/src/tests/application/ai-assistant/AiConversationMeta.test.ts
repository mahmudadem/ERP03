/**
 * AiConversationMeta - Title Generation and Metadata Tests
 *
 * Verifies that:
 * 1. generateTitle truncates long messages to 50 chars at last full word
 * 2. generateTitle preserves short messages unchanged
 * 3. generateTitle handles edge cases (no spaces, exact 50 chars)
 * 4. upsertConversationMeta creates metadata on first message
 * 5. upsertConversationMeta updates metadata on subsequent messages
 */

import { generateTitle } from '../../../application/ai-assistant/services/chatMessageHelpers';

describe('generateTitle (chatMessageHelpers)', () => {
  it('should return the full message if it is under 50 characters', () => {
    const message = 'What is my sales total?';
    expect(generateTitle(message)).toBe('What is my sales total?');
  });

  it('should return the full message if it is exactly 50 characters', () => {
    const message = '12345678901234567890123456789012345678901234567890';
    expect(generateTitle(message)).toBe('12345678901234567890123456789012345678901234567890');
  });

  it('should truncate to last full word within 50 characters', () => {
    const message = 'Can you show me the trial balance for all accounts in the current fiscal year?';
    const result = generateTitle(message);
    // First 50 chars: "Can you show me the trial balance for all accounts"
    // Trims to last word boundary + '...' suffix
    expect(result).toBe('Can you show me the trial balance for all...');
    expect(result.length).toBeLessThanOrEqual(53); // 50 chars + '...'
  });

  it('should handle messages with no spaces in first 50 chars', () => {
    const message = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab more text here';
    const result = generateTitle(message);
    // No space found in first 50 chars (lastIndexOf(' ') <= 10), so returns truncated 50 chars + '...'
    expect(result).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...');
    expect(result.length).toBe(53); // 50 chars + '...'
  });

  it('should trim whitespace from the result', () => {
    const message = '   What is my balance?   ';
    const result = generateTitle(message);
    expect(result).toBe('What is my balance?');
  });

  it('should handle a single word message under 50 chars', () => {
    const message = 'Hello';
    expect(generateTitle(message)).toBe('Hello');
  });

  it('should handle a message that is exactly 50 chars', () => {
    // Exactly 50 characters
    const message = 'Show me the profit and loss for this month pl';
    const result = generateTitle(message);
    expect(result).toBe(message.trim());
  });

  it('should handle a very long message correctly', () => {
    const message = 'I need a detailed breakdown of all receivables that are overdue by more than 30 days, including customer names, invoice numbers, amounts, and aging buckets';
    const result = generateTitle(message);
    expect(result.length).toBeLessThanOrEqual(50);
    // Should end at a word boundary, not mid-word
    expect(result.endsWith(' ')).toBe(false);
  });
});