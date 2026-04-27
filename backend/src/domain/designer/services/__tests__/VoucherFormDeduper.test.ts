import {
  canonicalizeVoucherCode,
  dedupeVoucherForms,
  getVoucherFormLogicalKey,
} from '../VoucherFormDeduper';

describe('VoucherFormDeduper', () => {
  it('canonicalizes legacy accounting voucher aliases', () => {
    expect(canonicalizeVoucherCode('JOURNAL')).toBe('journal_entry');
    expect(canonicalizeVoucherCode('JV')).toBe('journal_entry');
    expect(canonicalizeVoucherCode('PAYMENT')).toBe('payment');
    expect(canonicalizeVoucherCode('RV')).toBe('receipt');
    expect(canonicalizeVoucherCode('FX')).toBe('fx_revaluation');
  });

  it('builds a stable logical key for default voucher forms', () => {
    expect(getVoucherFormLogicalKey({
      module: 'ACCOUNTING',
      code: 'JOURNAL',
      typeId: 'ACCOUNTING',
    })).toBe('ACCOUNTING::journal_entry');
  });

  it('dedupes only system/default forms and preserves user copies', () => {
    const forms = [
      {
        id: 'legacy_journal',
        module: 'ACCOUNTING',
        code: 'JOURNAL',
        typeId: 'ACCOUNTING',
        name: 'Journal Entry',
        isDefault: true,
        isSystemGenerated: true,
        isLocked: true,
      },
      {
        id: 'canonical_journal',
        module: 'ACCOUNTING',
        code: 'journal_entry',
        typeId: 'type_journal',
        baseType: 'journal_entry',
        name: 'Journal Entry',
        isDefault: true,
        isSystemGenerated: true,
        isLocked: true,
      },
      {
        id: 'journal_copy',
        module: 'ACCOUNTING',
        code: 'JOURNAL',
        typeId: 'JOURNAL',
        name: 'Journal Entry - Copy',
        isDefault: false,
        isSystemGenerated: false,
        isLocked: false,
      },
    ];

    const result = dedupeVoucherForms(forms);

    expect(result.map((form) => form.id)).toEqual(['canonical_journal', 'journal_copy']);
  });
});
