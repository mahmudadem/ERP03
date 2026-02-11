import { CostCenter, CostCenterStatus } from '../../../../domain/accounting/entities/CostCenter';

describe('CostCenter entity', () => {
  it('validates required fields', () => {
    const cc = new CostCenter('', 'c1', '', '');
    expect(cc.validate()).toContain('Code is required');
    expect(cc.validate()).toContain('Name is required');
  });

  it('enforces max code length', () => {
    const cc = new CostCenter('1', 'c1', 'Name', '123456789012345678901');
    expect(cc.validate()).toContain('Code must be 20 characters or less');
  });

  it('deactivates', () => {
    const cc = new CostCenter('1', 'c1', 'Name', 'CC', null, null, CostCenterStatus.ACTIVE, new Date(), 'u1', new Date(), 'u1');
    cc.deactivate('admin');
    expect(cc.status).toBe(CostCenterStatus.INACTIVE);
    expect(cc.updatedBy).toBe('admin');
  });
});
