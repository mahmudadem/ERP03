/**
 * ModuleManifest.ts
 *
 * Contract for module implementation manifest.
 * Every code-based module must expose this manifest.
 * Used for implementation validation and availability checks.
 */

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  capabilities?: string[];
  requiredPermissions: string[];
}

export interface ModuleManifestEntry {
  manifest: ModuleManifest;
  hasRouter: boolean;
  permissionsDefined: boolean;
}