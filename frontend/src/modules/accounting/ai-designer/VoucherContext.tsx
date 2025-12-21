import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import {
  migrateLocalStorageToCanonical,
  loadCanonicalDefinitions,
  saveCanonicalDefinitionsValidated
} from './migrations/migrateLocalStorageToCanonical';

/**
 * AI Designer Voucher Context
 * 
 * MIGRATED TO CANONICAL SCHEMA V2
 * 
 * State Model: VoucherTypeDefinition[] (Schema V2 ONLY)
 * Storage: localStorage (canonical key: cloudERP_vouchers_v2)
 * 
 * Migration:
 * - On first load, migrates legacy data if present
 * - All migrated fields marked as non-posting
 * - Manual review required before use
 */

interface VoucherContextType {
  // State (Canonical ONLY)
  definitions: VoucherTypeDefinition[];
  
  // Actions
  addDefinition: (definition: VoucherTypeDefinition) => void;
  updateDefinition: (id: string, definition: VoucherTypeDefinition) => void;
  deleteDefinition: (id: string) => void;
  
  // Migration status
  migrationCompleted: boolean;
  migrationWarning: string | null;
  
  // Loading state
  loading: boolean;
  error: string | null;
}

const VoucherContext = createContext<VoucherContextType | undefined>(undefined);

export const VoucherProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // CANONICAL STATE ONLY
  const [definitions, setDefinitions] = useState<VoucherTypeDefinition[]>([]);
  
  // Migration status
  const [migrationCompleted, setMigrationCompleted] = useState(false);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =================================================================
  // INITIALIZATION & MIGRATION
  // =================================================================

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    setLoading(true);
    setError(null);

    try {
      // STEP 1: Check and run migration if needed
      const migrationResult = migrateLocalStorageToCanonical();
      
      if (migrationResult.success && migrationResult.migratedCount > 0) {
        setMigrationWarning(
          `⚠️ Migrated ${migrationResult.migratedCount} voucher definitions from legacy format.\n\n` +
          `CRITICAL: All fields marked as NON-POSTING.\n` +
          `Manual review and posting classification required before use.\n\n` +
          `Backup created: ${migrationResult.backupKey}`
        );
        console.warn('[AI Designer] Migration completed:', migrationResult);
      }

      setMigrationCompleted(true);

      // STEP 2: Load canonical definitions
      const loaded = loadCanonicalDefinitions();
      
      // GUARD: Validate all are Schema V2
      const validated = loaded.filter(def => {
        if (def.schemaVersion !== 2) {
          console.error(`Rejected definition "${def.name}": schema version ${def.schemaVersion}`);
          return false;
        }
        return true;
      });

      setDefinitions(validated);
      console.log(`[AI Designer] Loaded ${validated.length} canonical definitions`);

    } catch (err: any) {
      setError(err.message);
      console.error('[AI Designer] Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  // =================================================================
  // CRUD OPERATIONS (CANONICAL ONLY)
  // =================================================================

  const addDefinition = (definition: VoucherTypeDefinition) => {
    // GUARD 1: Validate Schema V2
    if (definition.schemaVersion !== 2) {
      throw new Error(
        `Cannot add definition: schemaVersion must be 2. Received: ${definition.schemaVersion}`
      );
    }

    // GUARD 2: Validate canonical structure
    validateCanonicalDefinition(definition, 'add');

    // Add to state
    const updated = [...definitions, definition];
    setDefinitions(updated);

    // Save to localStorage (canonical only)
    saveToLocalStorage(updated);

    console.log(`[AI Designer] Added definition: ${definition.name} (${definition.code})`);
  };

  const updateDefinition = (id: string, definition: VoucherTypeDefinition) => {
    // GUARD 1: Validate Schema V2
    if (definition.schemaVersion !== 2) {
      throw new Error(
        `Cannot update definition: schemaVersion must be 2. Received: ${definition.schemaVersion}`
      );
    }

    // GUARD 2: Validate canonical structure
    validateCanonicalDefinition(definition, 'update');

    // Update in state
    const updated = definitions.map(def =>
      def.id === id ? definition : def
    );
    setDefinitions(updated);

    // Save to localStorage (canonical only)
    saveToLocalStorage(updated);

    console.log(`[AI Designer] Updated definition: ${definition.name} (${definition.code})`);
  };

  const deleteDefinition = (id: string) => {
    const updated = definitions.filter(def => def.id !== id);
    setDefinitions(updated);

    // Save to localStorage
    saveToLocalStorage(updated);

    console.log(`[AI Designer] Deleted definition: ${id}`);
  };

  // =================================================================
  // PERSISTENCE (CANONICAL ONLY)
  // =================================================================

  const saveToLocalStorage = (defs: VoucherTypeDefinition[]) => {
    try {
      // GUARD: Validate all are Schema V2 before saving
      validateAllCanonical(defs);

      // Save canonical definitions
      saveCanonicalDefinitionsValidated(defs);

    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
      console.error('[AI Designer] Save error:', err);
      throw err;
    }
  };

  // =================================================================
  // GUARDS & VALIDATION
  // =================================================================

  /**
   * Validate individual definition is canonical
   */
  function validateCanonicalDefinition(def: any, operation: string): void {
    const errors: string[] = [];

    // Check 1: schemaVersion exists and is 2
    if (typeof def.schemaVersion !== 'number' || def.schemaVersion !== 2) {
      errors.push(`schemaVersion must be 2 (received: ${def.schemaVersion})`);
    }

    // Check 2: Required canonical properties
    if (!def.id) errors.push('Missing id');
    if (!def.code) errors.push('Missing code');
    if (!def.module) errors.push('Missing module');
    if (!def.name) errors.push('Missing name');

    // Check 3: Required arrays
    if (!Array.isArray(def.headerFields)) {
      errors.push('headerFields must be an array');
    }
    if (!Array.isArray(def.tableColumns)) {
      errors.push('tableColumns must be an array');
    }

    // Check 4: No legacy properties
    const legacyProps = ['prefix', 'rules', 'actions', 'uiModeOverrides', 'isMultiLine'];
    legacyProps.forEach(prop => {
      if (prop in def) {
        errors.push(`Legacy property "${prop}" not allowed in Schema V2`);
      }
    });

    if (errors.length > 0) {
      throw new Error(
        `Validation failed (${operation}):\n- ${errors.join('\n- ')}\n\n` +
        `AI Designer must use canonical VoucherTypeDefinition (Schema V2) only.`
      );
    }
  }

  /**
   * Validate all definitions are canonical
   */
  function validateAllCanonical(defs: VoucherTypeDefinition[]): void {
    defs.forEach((def, index) => {
      try {
        validateCanonicalDefinition(def, `save[${index}]`);
      } catch (error: any) {
        throw new Error(`Definition ${index} (${def.name}): ${error.message}`);
      }
    });
  }

  // =================================================================
  // CONTEXT VALUE
  // =================================================================

  const value: VoucherContextType = {
    definitions,
    addDefinition,
    updateDefinition,
    deleteDefinition,
    migrationCompleted,
    migrationWarning,
    loading,
    error
  };

  return (
    <VoucherContext.Provider value={value}>
      {children}
    </VoucherContext.Provider>
  );
};

export const useVouchers = (): VoucherContextType => {
  const context = useContext(VoucherContext);
  if (!context) {
    // Return safe defaults instead of throwing to prevent crashes during initialization
    return {
      definitions: [],
      addDefinition: () => {},
      updateDefinition: () => {},
      deleteDefinition: () => {},
      migrationCompleted: false,
      migrationWarning: null,
      loading: true,
      error: 'VoucherProvider not found. Wrap component in VoucherProvider.'
    };
  }
  return context;
};