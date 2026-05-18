import { AiResponseSanitizer } from '../../../application/ai-assistant/services/AiResponseSanitizer';

describe('AiResponseSanitizer', () => {
  it('leaves clean text untouched', () => {
    const result = AiResponseSanitizer.sanitize('Here is a plain answer with no fake tool calls.');
    expect(result.modified).toBe(false);
    expect(result.text).toBe('Here is a plain answer with no fake tool calls.');
    expect(result.warning).toBe('');
    expect(result.matchedPatterns).toEqual([]);
  });

  it('strips multi-line <tool_code> blocks and reports the match', () => {
    const raw = `Here is the account statement:
<tool_code>
print(accounting.getLedger({"account_code": "1010101"}))
</tool_code>
Total: $5,750.00`;
    const result = AiResponseSanitizer.sanitize(raw);
    expect(result.modified).toBe(true);
    expect(result.text).not.toContain('<tool_code>');
    expect(result.text).not.toContain('print(accounting.getLedger');
    expect(result.text).toContain('attempted to fake a tool call');
    expect(result.matchedPatterns).toContain('tool_code-block');
  });

  it('strips <tool_output> blocks containing fake JSON', () => {
    const raw = `<tool_output>
{"account_code":"1010101","opening_balance":5000.0,"closing_balance":5750.0}
</tool_output>`;
    const result = AiResponseSanitizer.sanitize(raw);
    expect(result.modified).toBe(true);
    expect(result.text).not.toContain('opening_balance');
    expect(result.text).not.toContain('<tool_output>');
    expect(result.matchedPatterns).toContain('tool_output-block');
  });

  it('strips multiple block types from the same reply', () => {
    const raw = `accounting.getLedger({"account_code": "1010101"})
<tool_code>some pseudo code</tool_code>
<tool_output>{"transactions":[]}</tool_output>
<tool_result>{"closing_balance": 999}</tool_result>
print(accounting.getLedger({"account_code": "1010101"}))
Done.`;
    const result = AiResponseSanitizer.sanitize(raw);
    expect(result.modified).toBe(true);
    expect(result.text).not.toContain('<tool_code>');
    expect(result.text).not.toContain('<tool_output>');
    expect(result.text).not.toContain('<tool_result>');
    expect(result.text).not.toContain('closing_balance');
    expect(result.text).not.toContain('print(accounting.getLedger');
    expect(new Set(result.matchedPatterns)).toEqual(
      new Set(['tool_code-block', 'tool_output-block', 'tool_result-block', 'fake-print-toolcall']),
    );
    expect(result.warning).toContain('fabricate');
  });

  it('strips orphan opening tool tags left behind by sloppy generation', () => {
    const raw = `Some text\n<tool_output>\nbut this block never closed\nmore stuff`;
    const result = AiResponseSanitizer.sanitize(raw);
    expect(result.modified).toBe(true);
    expect(result.text).not.toContain('<tool_output>');
  });

  it('returns the raw input for empty or non-string values without throwing', () => {
    expect(AiResponseSanitizer.sanitize('').modified).toBe(false);
    expect(AiResponseSanitizer.sanitize(null as any).text).toBe('');
    expect(AiResponseSanitizer.sanitize(undefined as any).text).toBe('');
  });

  it('collapses adjacent replacement banners so we never produce a wall of warnings', () => {
    const raw = `<tool_code>a</tool_code><tool_output>b</tool_output><tool_result>c</tool_result>`;
    const result = AiResponseSanitizer.sanitize(raw);
    expect(result.modified).toBe(true);
    const occurrences = (result.text.match(/attempted to fake a tool call/g) || []).length;
    expect(occurrences).toBe(1);
  });
});
