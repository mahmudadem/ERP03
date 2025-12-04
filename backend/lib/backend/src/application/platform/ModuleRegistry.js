"use strict";
/**
 * ModuleRegistry.ts
 *
 * Central registry for all modules in the system.
 * Modules register themselves on startup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleRegistry = void 0;
class ModuleRegistry {
    constructor() {
        this.modules = new Map();
    }
    static getInstance() {
        if (!ModuleRegistry.instance) {
            ModuleRegistry.instance = new ModuleRegistry();
        }
        return ModuleRegistry.instance;
    }
    /**
     * Register a module
     */
    register(module) {
        if (this.modules.has(module.metadata.id)) {
            throw new Error(`Module ${module.metadata.id} is already registered`);
        }
        console.log(`Registering module: ${module.metadata.id} v${module.metadata.version}`);
        this.modules.set(module.metadata.id, module);
    }
    /**
     * Get a module by ID
     */
    getModule(moduleId) {
        return this.modules.get(moduleId);
    }
    /**
     * Get all registered modules
     */
    getAllModules() {
        return Array.from(this.modules.values());
    }
    /**
     * Check if a module is registered
     */
    isModuleRegistered(moduleId) {
        return this.modules.has(moduleId);
    }
    /**
     * Initialize all modules
     */
    async initializeAll() {
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
    async shutdownAll() {
        for (const module of this.modules.values()) {
            if (module.shutdown) {
                await module.shutdown();
            }
        }
    }
}
exports.ModuleRegistry = ModuleRegistry;
//# sourceMappingURL=ModuleRegistry.js.map