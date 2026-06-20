/**
 * modules/index.ts
 * 
 * Central module registration point.
 * All modules register themselves here on startup.
 */

import { ModuleRegistry } from '../application/platform/ModuleRegistry';
import { AccountingModule } from './accounting/AccountingModule';
import { InventoryModule } from './inventory/InventoryModule';
import { PurchaseModule } from './purchase/PurchaseModule';
import { SalesModule } from './sales/SalesModule';
import { PosModule } from './pos/PosModule';
import { AiAssistantModule } from './ai-assistant/AiAssistantModule';

export function registerAllModules(): void {
    const registry = ModuleRegistry.getInstance();

    // Register modules
    registry.register(new AccountingModule());
    registry.register(new InventoryModule());
    registry.register(new PurchaseModule());
    registry.register(new SalesModule());
    registry.register(new PosModule());
    registry.register(new AiAssistantModule());

    console.log(`Registered ${registry.getAllModules().length} modules`);
}
