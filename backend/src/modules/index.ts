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

    // Idempotent: the startup path retries on a transient DB outage at boot, and
    // each retry re-runs this function. Re-registering an already-registered
    // module would throw ("Module X is already registered") and permanently
    // brick the worker, defeating the retry. Register only what's missing.
    const modules = [
        new AccountingModule(),
        new InventoryModule(),
        new PurchaseModule(),
        new SalesModule(),
        new PosModule(),
        new AiAssistantModule(),
    ];

    for (const module of modules) {
        if (!registry.isModuleRegistered(module.metadata.id)) {
            registry.register(module);
        }
    }

    console.log(`Registered ${registry.getAllModules().length} modules`);
}
