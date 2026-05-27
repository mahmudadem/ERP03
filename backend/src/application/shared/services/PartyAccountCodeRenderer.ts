/**
 * Renders a party sub-account user code from a tenant-configured template.
 *
 * Tokens:
 *  - {parent}      → parent account userCode
 *  - {partyCode}   → party's code
 *  - {seq3}        → zero-padded 3-digit sequence (next available under parent)
 *
 * The {seq3} token is opaque to this pure renderer — the caller resolves
 * the next sequence by querying the account repo and passes it in.
 */

export const DEFAULT_PARTY_ACCOUNT_CODE_FORMAT = '{parent}-{partyCode}';

export interface PartyAccountCodeContext {
  parent: string;
  partyCode: string;
  seq?: number;
}

const ZERO_PAD = (n: number, width: number) => {
  const s = String(Math.max(0, Math.floor(n)));
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
};

export function renderPartyAccountCode(
  template: string | undefined,
  ctx: PartyAccountCodeContext
): string {
  const tpl = (template && template.trim()) || DEFAULT_PARTY_ACCOUNT_CODE_FORMAT;
  return tpl
    .replace(/\{parent\}/g, ctx.parent)
    .replace(/\{partyCode\}/g, ctx.partyCode)
    .replace(/\{seq3\}/g, ZERO_PAD(ctx.seq ?? 1, 3));
}

/**
 * True if the template references {seq3}. When true, the caller must resolve
 * the next sequence under the parent before rendering.
 */
export function templateUsesSequence(template: string | undefined): boolean {
  return /\{seq3\}/.test(template || DEFAULT_PARTY_ACCOUNT_CODE_FORMAT);
}

/**
 * Validates that a template contains at least one of {partyCode} or {seq3}.
 * Without one of these the rendered code would collide for every party.
 */
export function validatePartyAccountCodeFormat(template: string | undefined): string | null {
  const tpl = (template && template.trim()) || DEFAULT_PARTY_ACCOUNT_CODE_FORMAT;
  if (!/\{partyCode\}|\{seq3\}/.test(tpl)) {
    return 'partyAccountCodeFormat must contain {partyCode} or {seq3} to keep generated codes unique';
  }
  return null;
}
