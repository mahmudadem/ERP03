import { PermissionCatalogSyncService } from '../PermissionCatalogSyncService';

describe('PermissionCatalogSyncService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats permission name correctly', () => {
    const service = new PermissionCatalogSyncService() as any;
    
    expect(service.formatPermissionName('test.view')).toBe('View Manage');
    expect(service.formatPermissionName('inventory.accounts.view')).toBe('Accounts View');
  });

  it('formats permission description correctly', () => {
    const service = new PermissionCatalogSyncService() as any;
    
    expect(service.formatPermissionDescription('test.view', 'test', 'view')).toBe('View test data');
    expect(service.formatPermissionDescription('test.accounts.manage', 'test', 'manage')).toBe('Manage test settings and configuration');
  });

  it('capitalizes correctly', () => {
    const service = new PermissionCatalogSyncService() as any;
    
    expect(service.capitalize('view')).toBe('View');
    expect(service.capitalize('manage')).toBe('Manage');
  });
});