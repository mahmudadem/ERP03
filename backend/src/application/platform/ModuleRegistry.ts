/**
 * ModuleRegistry.ts
 * 
 * Central registry for all modules in the system.
 * Modules register themselves on startup.
 */

import { IModule } from '../../domain/platform/IModule';

export class ModuleRegistry {
    private static instance: ModuleRegistry;
    private modules: Map<string, IModule> = new Map();

    private constructor() { }

    static getInstance(): ModuleRegistry {
        if (!ModuleRegistry.instance) {
            ModuleRegistry.instance = new ModuleRegistry();
        }
        return ModuleRegistry.instance;
    }

    /**
     * Register a module
     */
    register(module: IModule): void {
        if (this.modules.has(module.metadata.id)) {
            throw new Error(`Module ${module.metadata.id} is already registered`);
        }

        console.log(`Registering module: ${module.metadata.id} v${module.metadata.version}`);
        this.modules.set(module.metadata.id, module);
    }

    /**
     * Get a module by ID
     */
    getModule(moduleId: string): IModule | undefined {
        return this.modules.get(moduleId);
    }

    /**
     * Get all registered modules
     */
    getAllModules(): IModule[] {
        return Array.from(this.modules.values());
    }

    /**
     * Check if a module is registered
     */
    isModuleRegistered(moduleId: string): boolean {
        return this.modules.has(moduleId);
    }

    /**
     * Initialize all modules
     */
    async initializeAll(): Promise<void> {
        console.log('Initializing all modules...');

        for (const module of this.modules.values()) {
            if (module.initialize) {
                await module.initialize();
            }
        }

        console.log(`Initialized ${this.modules.size} modules`);
    }

    /**
     * Shutdown all modules
     */
    async shutdownAll(): Promise<void> {
        for (const module of this.modules.values()) {
            if (module.shutdown) {
                await module.shutdown();
            }
        }
    }
}
