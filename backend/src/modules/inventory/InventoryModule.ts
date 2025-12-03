/**
 * InventoryModule.ts
 * 
 * Inventory module implementation that registers with the platform.
 */

import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import inventoryRoutes from '../../api/routes/inventory.routes';

export class InventoryModule implements IModule {
    metadata: ModuleMetadata = {
        id: 'inventory',
        name: 'Inventory',
        version: '1.0.0',
        description: 'Inventory management with items, warehouses, and stock movements',
        requiredBundles: ['professional', 'enterprise']
    };

    permissions: string[] = [
        'inventory.view',
        'inventory.items.view',
        'inventory.items.manage',
        'inventory.stock.adjust'
    ];

    async initialize(): Promise<void> {
        console.log('Initializing Inventory Module...');
    }

    getRouter(): Router {
        return inventoryRoutes;
    }

    async shutdown(): Promise<void> {
        console.log('Shutting down Inventory Module...');
    }
}
