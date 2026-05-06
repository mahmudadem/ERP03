/**
 * InventoryModule.ts
 * 
 * Inventory module implementation that registers with the platform.
 */

import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import { ModuleManifest } from '../../domain/platform/ModuleManifest';
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
        'inventory.settings.view',
        'inventory.settings.manage',
        'inventory.items.view',
        'inventory.items.manage',
        'inventory.categories.view',
        'inventory.categories.manage',
        'inventory.warehouses.view',
        'inventory.warehouses.manage',
        'inventory.uom.view',
        'inventory.uom.manage',
        'inventory.stock.view',
        'inventory.stock.adjust',
        'inventory.stockLevels.view',
        'inventory.movements.view',
        'inventory.movements.record',
        'inventory.valuation.view',
        'inventory.reconcile.run'
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
        console.log('Initializing Inventory Module...');
    }

    getRouter(): Router {
        return inventoryRoutes;
    }

    async shutdown(): Promise<void> {
        console.log('Shutting down Inventory Module...');
    }
}
