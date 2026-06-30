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
    const registerOnce = (module: AccountingModule | InventoryModule | PurchaseModule | SalesModule | PosModule | AiAssistantModule) => {
        if (registry.isModuleRegistered(module.metadata.id)) {
            return;
        }
        registry.register(module);
    };

    // Register modules (idempotent: registerOnce skips already-registered modules,
    // so the boot-retry loop can safely re-run this after a transient DB outage).
    registerOnce(new AccountingModule());
    registerOnce(new InventoryModule());
    registerOnce(new PurchaseModule());
    registerOnce(new SalesModule());
    registerOnce(new PosModule());
    registerOnce(new AiAssistantModule());

    console.log(`Registered ${registry.getAllModules().length} modules`);
}
