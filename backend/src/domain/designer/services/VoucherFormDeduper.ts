export interface VoucherFormLike {
  id?: string;
  module?: string | null;
  typeId?: string | null;
  code?: string | null;
  formType?: string | null;
  baseType?: string | null;
  name?: string | null;
  isDefault?: boolean;
  isSystemGenerated?: boolean;
  isLocked?: boolean;
}

const normalizeModule = (value: string | null | undefined): string =>
  String(value || '').trim().toUpperCase();

export const canonicalizeVoucherCode = (value: string | null | undefined): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'journal' || normalized === 'jv') return 'journal_entry';
  if (normalized === 'payment' || normalized === 'pv') return 'payment';
  if (normalized === 'receipt' || normalized === 'rv') return 'receipt';
  if (normalized === 'opening' || normalized === 'ob') return 'opening_balance';
  if (normalized === 'fx' || normalized === 'fxr' || normalized === 'revaluation') return 'fx_revaluation';
  return normalized;
};

export const isSystemDefaultVoucherForm = (form: VoucherFormLike): boolean =>
  form.isDefault === true || form.isSystemGenerated === true || form.isLocked === true;

export const getVoucherFormLogicalKey = (form: VoucherFormLike): string => {
  const module = normalizeModule(form.module) || 'ACCOUNTING';
  const code = canonicalizeVoucherCode(form.formType || form.baseType || form.code || form.typeId || form.id || form.name);
  return `${module}::${code}`;
};

const rankDefaultForm = (form: VoucherFormLike): number => {
  const module = normalizeModule(form.module) || 'ACCOUNTING';
  const typeId = canonicalizeVoucherCode(form.typeId);
  const code = canonicalizeVoucherCode(form.code);
  const baseType = canonicalizeVoucherCode(form.formType || form.baseType);
  const id = canonicalizeVoucherCode(form.id);

  let score = 0;
  if (baseType) score += 8;
  if (typeId && typeId !== module.toLowerCase()) score += 6;
  if (code && code !== module.toLowerCase()) score += 4;
  if (id && id !== module.toLowerCase()) score += 2;
  return score;
};

export function dedupeVoucherForms<T extends VoucherFormLike>(forms: T[]): T[] {
  const result: T[] = [];
  const defaultByKey = new Map<string, number>();

  forms.forEach((form) => {
    if (!isSystemDefaultVoucherForm(form)) {
      result.push(form);
      return;
    }

    const key = getVoucherFormLogicalKey(form);
    const existingIndex = defaultByKey.get(key);

    if (existingIndex === undefined) {
      defaultByKey.set(key, result.length);
      result.push(form);
      return;
    }

    if (rankDefaultForm(form) > rankDefaultForm(result[existingIndex])) {
      result[existingIndex] = form;
    }
  });

  return result;
}
