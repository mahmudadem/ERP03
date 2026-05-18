/**
 * AiResponseSanitizer — defensive filter that strips hallucinated tool-call blocks
 * out of assistant text responses before they reach the user.
 *
 * BACKGROUND
 * Small / uncertified / text-only models will sometimes emit fake tool calls and
 * fake tool results inline in their reply, e.g.:
 *
 *     <tool_code>
 *     print(accounting.getLedger({"account_code": "1010101"}))
 *     </tool_code>
 *     <tool_output>
 *     {"transactions": [{"date":"2023-10-02","debit":5000.0,...}]}
 *     </tool_output>
 *
 * To the user these are indistinguishable from real ERP data. We therefore
 * detect these patterns and replace them with a single visible warning so the
 * user knows the model misbehaved and the values are NOT real.
 *
 * This is independent of the system prompt (which already forbids the
 * behavior) — that's the carrot, this is the stick. Both must exist because
 * uncertified models often ignore the prompt.
 *
 * The sanitizer is conservative: when no fake blocks are detected the text is
 * returned unchanged. False positives on a well-behaved model's literal
 * code-fence blocks are still possible (e.g. the model genuinely shows
 * `<tool_code>` as documentation) — we accept that trade-off because real ERP
 * answers don't contain those tokens.
 */

export interface SanitizeResult {
  /** The cleaned text, safe to display. */
  text: string;
  /** True when at least one fake block was stripped. */
  modified: boolean;
  /** One-line user-facing warning to surface alongside the cleaned text, or empty. */
  warning: string;
  /** Specific patterns that were matched, for telemetry / audit. */
  matchedPatterns: string[];
}

const FAKE_BLOCK_REPLACEMENT =
  '\n\n[⚠️ The model attempted to fake a tool call here. The block has been removed because no tool actually ran. Open the relevant ERP module to see real data.]\n\n';

const USER_FACING_WARNING =
  'The selected model tried to fabricate a tool call in this reply. The fabricated section has been removed and any numbers it showed are NOT from your ERP. Pick a certified model in AI Settings.';

/**
 * Patterns we strip. Each is a (regex, label) tuple — the label is reported in
 * `matchedPatterns` for telemetry so we can spot new model misbehavior.
 *
 * IMPORTANT: order matters. Match larger blocks first so we don't leave
 * orphaned opening / closing tags after a smaller pattern wins.
 */
const FAKE_BLOCK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Paired XML-ish tool tags spanning multiple lines.
  { pattern: /<tool_code\b[^>]*>[\s\S]*?<\/tool_code>/gi, label: 'tool_code-block' },
  { pattern: /<tool_output\b[^>]*>[\s\S]*?<\/tool_output>/gi, label: 'tool_output-block' },
  { pattern: /<tool_result\b[^>]*>[\s\S]*?<\/tool_result>/gi, label: 'tool_result-block' },
  { pattern: /<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi, label: 'tool_call-block' },
  { pattern: /<function_call\b[^>]*>[\s\S]*?<\/function_call>/gi, label: 'function_call-block' },
  { pattern: /<function_response\b[^>]*>[\s\S]*?<\/function_response>/gi, label: 'function_response-block' },

  // Orphaned opening / closing tags left behind by sloppy generation.
  { pattern: /<\/?(?:tool_code|tool_output|tool_result|tool_call|function_call|function_response)\b[^>]*>/gi, label: 'orphan-tool-tag' },

  // Pseudo-Python `print(<namespace>.<method>(...))` lines that are commonly
  // used by Gemma / Qwen / GPT-OSS to fake tool execution. We match a single
  // line, not a multi-line block, to avoid eating legitimate paragraphs.
  { pattern: /^[ \t]*print\(\s*[a-z][a-z0-9_]*\.[a-z][a-zA-Z0-9_]*\([^)]*\)\s*\)\s*$/gim, label: 'fake-print-toolcall' },
];

export class AiResponseSanitizer {
  /**
   * Strip hallucinated tool-call blocks. Returns the original text untouched
   * when nothing matches.
   */
  static sanitize(raw: string): SanitizeResult {
    if (!raw || typeof raw !== 'string') {
      return { text: raw ?? '', modified: false, warning: '', matchedPatterns: [] };
    }

    let working = raw;
    const matched: string[] = [];

    for (const { pattern, label } of FAKE_BLOCK_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(working)) {
        matched.push(label);
        pattern.lastIndex = 0;
        working = working.replace(pattern, FAKE_BLOCK_REPLACEMENT);
      }
    }

    if (matched.length === 0) {
      return { text: raw, modified: false, warning: '', matchedPatterns: [] };
    }

    // Collapse consecutive replacement banners into one.
    const banner = FAKE_BLOCK_REPLACEMENT.trim();
    const collapseRegex = new RegExp(`(?:${banner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*){2,}`, 'g');
    working = working.replace(collapseRegex, `\n\n${banner}\n\n`);

    // Collapse the 3+ blank lines that can result from large strips.
    working = working.replace(/\n{3,}/g, '\n\n').trim();

    return {
      text: working,
      modified: true,
      warning: USER_FACING_WARNING,
      matchedPatterns: Array.from(new Set(matched)),
    };
  }
}
