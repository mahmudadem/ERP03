import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import salesRoutes from '../../api/routes/sales.routes';

export class SalesModule implements IModule {
  metadata: ModuleMetadata = {
    id: 'sales',
    name: 'Sales',
    version: '1.0.0',
    description: 'Sales settings and sales order management',
    requiredBundles: ['professional', 'enterprise'],
  };

  permissions: string[] = [
    'sales.view',
    'sales.settings.view',
    'sales.settings.manage',
    'sales.orders.view',
    'sales.orders.manage',
  ];

  async initialize(): Promise<void> {
    console.log('Initializing Sales Module...');
  }

  getRouter(): Router {
    return salesRoutes;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Sales Module...');
  }
}
