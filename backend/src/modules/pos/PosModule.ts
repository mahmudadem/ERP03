import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import { ModuleManifest } from '../../domain/platform/ModuleManifest';
import posRoutes from '../../api/routes/pos.routes';

export class PosModule implements IModule {
  metadata: ModuleMetadata = {
    id: 'pos',
    name: 'POS',
    version: '1.0.0',
    description: 'Point of Sale terminal, shifts, cash drawer, receipts and returns',
    requiredBundles: ['professional', 'enterprise'],
  };

  permissions: string[] = [
    'pos.terminal.access',
    'pos.shift.open',
    'pos.shift.close',
    'pos.shift.forceClose',
    'pos.cash.movement',
    'pos.return.create',
    'pos.receipt.reprint',
    'pos.registers.manage',
    'pos.settings.manage',
    'pos.reports.view',
  ];

  getManifest(): ModuleManifest {
    return {
      id: this.metadata.id,
      name: this.metadata.name,
      version: this.metadata.version,
      description: this.metadata.description,
      requiredPermissions: this.permissions,
    };
  }

  async initialize(): Promise<void> {
    console.log('Initializing POS Module...');
  }

  getRouter(): Router {
    return posRoutes;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down POS Module...');
  }
}
