import { PrintLayoutCore } from '../../../application/system-core/print-layout/PrintLayoutCore';

describe('PrintLayoutCore', () => {
  it('creates and validates a default POS receipt layout', () => {
    const core = new PrintLayoutCore();
    const layout = core.createDefaultLayout('POS_RECEIPT');
    const schema = core.getDataSchema('POS_RECEIPT');

    expect(layout.paper.type).toBe('RECEIPT_80');
    expect(layout.components.some((component) => component.type === 'table')).toBe(true);
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
});
