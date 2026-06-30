import { Uom } from '../../../domain/inventory/entities/Uom';

describe('Uom translations', () => {
  it('normalizes extensible language keys and preserves the default name', () => {
    const uom = new Uom({
      id: 'uom_piece',
      companyId: 'company_1',
      code: 'pcs',
      name: 'Piece',
      translations: { EN: ' Piece ', ar: 'قطعة', tr: 'Adet', fr: 'Pièce' },
      dimension: 'COUNT',
      decimalPlaces: 0,
      active: true,
      isSystem: false,
      createdBy: 'user_1',
      createdAt: new Date('2026-06-29T00:00:00Z'),
      updatedAt: new Date('2026-06-29T00:00:00Z'),
    });

    expect(uom.code).toBe('PCS');
    expect(uom.name).toBe('Piece');
    expect(uom.translations).toEqual({ en: 'Piece', ar: 'قطعة', tr: 'Adet', fr: 'Pièce' });
    expect(Uom.fromJSON(uom.toJSON()).translations.ar).toBe('قطعة');
  });
});
