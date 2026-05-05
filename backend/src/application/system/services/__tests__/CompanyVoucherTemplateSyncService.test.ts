import { VoucherTypeDefinition } from '../../../../domain/designer/entities/VoucherTypeDefinition';
import { syncCompanyVoucherTemplatesFromSystem } from '../CompanyVoucherTemplateSyncService';

const template = (id: string, code: string) =>
  new VoucherTypeDefinition(
    id,
    'SYSTEM',
    'Journal Entry',
    code,
    'ACCOUNTING',
    [],
    [],
    {},
    2
  );

describe('syncCompanyVoucherTemplatesFromSystem', () => {
  it('does not create a duplicate default form when a logical default already exists', async () => {
    const voucherTypeRepo = {
      getSystemTemplates: jest.fn().mockResolvedValue([template('sys_journal', 'journal_entry')]),
      getByCompanyId: jest.fn().mockResolvedValue([
        template('company_journal_type', 'journal_entry'),
      ]),
      updateVoucherType: jest.fn(),
      createVoucherType: jest.fn(),
    };
    voucherTypeRepo.getByCompanyId.mockResolvedValue([
      new VoucherTypeDefinition('company_journal_type', 'cmp_1', 'Journal Entry', 'journal_entry', 'ACCOUNTING', [], [], {}, 2),
    ]);

    const voucherFormRepo = {
      getAllByCompany: jest.fn().mockResolvedValue([
        {
          id: 'legacy_journal_form',
          companyId: 'cmp_1',
          module: 'ACCOUNTING',
          typeId: 'ACCOUNTING',
          code: 'JOURNAL',
          name: 'Journal Entry',
          isDefault: true,
          isSystemGenerated: true,
          isLocked: true,
          enabled: true,
          headerFields: [],
          tableColumns: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      getByTypeId: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    };

    const result = await syncCompanyVoucherTemplatesFromSystem({
      companyId: 'cmp_1',
      modules: ['ACCOUNTING'],
      createdBy: 'SYSTEM',
      voucherTypeRepo: voucherTypeRepo as any,
      voucherFormRepo: voucherFormRepo as any,
    });

    expect(result.formsCreated).toBe(0);
    expect(voucherFormRepo.create).not.toHaveBeenCalled();
    expect(voucherFormRepo.update).toHaveBeenCalledTimes(1);
  });

  it('dedupes legacy and canonical system templates by canonical code', async () => {
    const voucherTypeRepo = {
      getSystemTemplates: jest.fn().mockResolvedValue([
        template('sys_old_journal', 'JOURNAL'),
        template('sys_new_journal', 'journal_entry'),
      ]),
      getByCompanyId: jest.fn().mockResolvedValue([]),
      updateVoucherType: jest.fn(),
      createVoucherType: jest.fn(),
    };

    const voucherFormRepo = {
      getAllByCompany: jest.fn().mockResolvedValue([]),
      getByTypeId: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    };

    const result = await syncCompanyVoucherTemplatesFromSystem({
      companyId: 'cmp_1',
      modules: ['ACCOUNTING'],
      createdBy: 'SYSTEM',
      voucherTypeRepo: voucherTypeRepo as any,
      voucherFormRepo: voucherFormRepo as any,
    });

    expect(result.templatesUpserted).toBe(1);
    expect(voucherTypeRepo.createVoucherType).toHaveBeenCalledTimes(1);
    expect(voucherFormRepo.create).toHaveBeenCalledTimes(1);
  });
});
