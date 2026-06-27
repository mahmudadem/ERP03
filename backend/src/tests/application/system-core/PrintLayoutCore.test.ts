import { PrintLayoutCore } from '../../../application/system-core/print-layout/PrintLayoutCore';

describe('PrintLayoutCore', () => {
  it('creates and validates a default POS receipt layout', () => {
    const core = new PrintLayoutCore();
    const layout = core.createDefaultLayout('POS_RECEIPT');
    const schema = core.getDataSchema('POS_RECEIPT');

    expect(layout.paper.type).toBe('RECEIPT_80');
    expect(layout.components.some((component) => component.type === 'table')).toBe(true);
    expect(layout.components.find((component) => component.type === 'table')?.tableOptions?.overflowMode).toBe('continue');
    expect(() => core.validateLayout(layout, schema)).not.toThrow();
  });

  it('creates and validates a default Purchase Invoice layout', () => {
    const core = new PrintLayoutCore();
    const layout = core.createDefaultLayout('PURCHASE_INVOICE');
    const schema = core.getDataSchema('PURCHASE_INVOICE');

    expect(schema.documentType).toBe('PURCHASE_INVOICE');
    expect(schema.fields.some((field) => field.path === 'vendor.name')).toBe(true);
    expect(schema.tables[0].columns.some((column) => column.path === 'warehouse')).toBe(true);
    expect(layout.paper.type).toBe('A4');
    expect(layout.components.find((component) => component.id === 'doc_no')?.fieldPath).toBe('invoice.number');
    expect(() => core.validateLayout(layout, schema)).not.toThrow();
  });

  it('rejects unknown dynamic fields and components outside the paper area', () => {
    const core = new PrintLayoutCore();
    const schema = core.getDataSchema('POS_RECEIPT');
    const layout = core.createDefaultLayout('POS_RECEIPT');

    expect(() => core.validateLayout({
      ...layout,
      components: [{ ...layout.components[0], fieldPath: 'unsafe.script' }],
    }, schema)).toThrow(/Unknown print field/);

    expect(() => core.validateLayout({
      ...layout,
      components: [{ ...layout.components[0], x: 999 }],
    }, schema)).toThrow(/outside the paper area/);
  });

  it('rejects invalid table overflow settings', () => {
    const core = new PrintLayoutCore();
    const schema = core.getDataSchema('POS_RECEIPT');
    const layout = core.createDefaultLayout('POS_RECEIPT');
    const table = layout.components.find((component) => component.type === 'table');
    expect(table).toBeTruthy();

    expect(() => core.validateLayout({
      ...layout,
      components: [{
        ...table!,
        tableOptions: { ...table!.tableOptions, rowHeight: 0 },
      }],
    }, schema)).toThrow(/row height/);

    expect(() => core.validateLayout({
      ...layout,
      components: [{
        ...table!,
        tableOptions: { ...table!.tableOptions, overflowMode: 'scroll' as any },
      }],
    }, schema)).toThrow(/invalid overflow mode/);
  });
});
