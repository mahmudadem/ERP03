/**
 * modules/index.ts
 * 
 * Central module registration point.
 * All modules register themselves here on startup.
 */

import { ModuleRegistry } from '../application/platform/ModuleRegistry';
import { AccountingModule } from './accounting/AccountingModule';
import { InventoryModule } from './inventory/InventoryModule';

export function registerAllModules(): void {
    const registry = ModuleRegistry.getInstance();

    // Register modules
    registry.register(new AccountingModule());
    registry.register(new InventoryModule());
    // Add more modules here as they are created

    console.log(`Registered ${registry.getAllModules().length} modules`);
}
