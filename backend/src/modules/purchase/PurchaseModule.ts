import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import { ModuleManifest } from '../../domain/platform/ModuleManifest';
import purchasesRoutes from '../../api/routes/purchases.routes';

export class PurchaseModule implements IModule {
  metadata: ModuleMetadata = {
    id: 'purchase',
    name: 'Purchase',
    version: '1.0.0',
    description: 'Purchase settings and purchase order management',
    requiredBundles: ['professional', 'enterprise'],
  };

  permissions: string[] = [
    'purchase.view',
    'purchase.settings.view',
    'purchase.settings.manage',
    'purchase.orders.view',
    'purchase.orders.manage',
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
    console.log('Initializing Purchase Module...');
  }

  getRouter(): Router {
    return purchasesRoutes;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Purchase Module...');
  }
}
