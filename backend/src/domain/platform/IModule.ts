/**
 * IModule.ts
 * 
 * Interface that all modules must implement to register with the platform.
 */

import { Router } from 'express';

export interface ModuleMetadata {
    id: string;
    name: string;
    version: string;
    description?: string;
    requiredBundles?: string[];
    dependencies?: string[];
}

export interface IModule {
    /**
     * Module metadata
     */
    metadata: ModuleMetadata;

    /**
     * Permissions required by this module
     */
    permissions: string[];

    /**
     * Initialize the module (called on server startup)
     */
    initialize?(): Promise<void>;

    /**
     * Get the router for this module
     */
    getRouter(): Router;

    /**
     * Cleanup on shutdown
     */
    shutdown?(): Promise<void>;
}
