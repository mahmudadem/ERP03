/**
 * AccountingModule.ts
 * 
 * Accounting module implementation that registers with the platform.
 */

import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import { ModuleManifest } from '../../domain/platform/ModuleManifest';
import accountingRoutes from '../../api/routes/accounting.routes';

export class AccountingModule implements IModule {
    metadata: ModuleMetadata = {
        id: 'accounting',
        name: 'Accounting',
        version: '1.0.0',
        description: 'Core accounting module with vouchers, accounts, and financial reports',
        requiredBundles: ['starter', 'professional', 'enterprise']
    };

    permissions: string[] = [
        'accounting.view',
        'accounting.accounts.view',
        'accounting.accounts.manage',
        'accounting.vouchers.view',
        'accounting.vouchers.create',
        'accounting.vouchers.approve',
        'accounting.reports.view'
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
        console.log('Initializing Accounting Module...');
    }

    getRouter(): Router {
        return accountingRoutes;
    }

    async shutdown(): Promise<void> {
        console.log('Shutting down Accounting Module...');
    }
}
