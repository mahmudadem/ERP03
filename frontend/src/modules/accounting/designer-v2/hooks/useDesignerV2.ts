import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { VoucherLayoutV2 } from '../types/VoucherLayoutV2';
import { voucherTypeRepository } from '../../designer/repositories/VoucherTypeRepository';
import { canonicalToLayout } from '../converters/canonicalToLayout';
import { applyLayoutToCanonical, validateNoForbiddenChanges } from '../converters/applyLayoutToCanonical';

/**
 * Designer V2 Hook
 * 
 * Manages lifecycle of voucher layout editing with strict guards:
 * 1. LOAD: Canonical only → Generate layout
 * 2. EDIT: Layout changes in UI (ephemeral)
 * 3. SAVE: Apply changes to canonical → Save canonical only
 * 4. DISCARD: Layout after save
 * 
 * ⚠️ VoucherLayoutV2 NEVER persisted
 */
export const useDesignerV2 = (voucherCode: string) => {
  // CANONICAL: Source of truth (persisted)
  const [originalCanonical, setOriginalCanonical] = useState<VoucherTypeDefinition | null>(null);
  
  // LAYOUT: Derived view model (ephemeral, never persisted)
  const [layout, setLayout] = useState<VoucherLayoutV2 | null>(null);
  
  // STATE
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =================================================================
  // LOAD FLOW
  // =================================================================
  
  useEffect(() => {
    loadVoucherDefinition();
  }, [voucherCode]);

  const loadVoucherDefinition = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // STEP 1: Load CANONICAL from API (Schema V2 enforced by repository)
      const canonical = await voucherTypeRepository.get(voucherCode);
      
      // GUARD: Verify Schema V2
      if (canonical.schemaVersion !== 2) {
        throw new Error(
          `Invalid schema version: ${canonical.schemaVersion}. ` +
          `Designer V2 requires Schema V2 definitions.`
        );
      }
      
      // STEP 2: Store canonical as source of truth
      setOriginalCanonical(canonical);
      
      // STEP 3: Generate EPHEMERAL layout for UI
      const generatedLayout = canonicalToLayout(canonical, 'classic');
      setLayout(generatedLayout);
      
      console.log('[DesignerV2] Loaded canonical and generated layout:', {
        code: canonical.code,
        hasAccountingFields: canonical.headerFields.some(f => f.isPosting),
        layoutGenerated: true
      });
      
    } catch (err: any) {
      setError(err.message);
      console.error('[DesignerV2] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // =================================================================
  // SAVE FLOW WITH GUARDS
  // =================================================================
  
  const saveChanges = async (): Promise<boolean> => {
    // GUARD 1: Ensure original canonical exists
    if (!originalCanonical) {
      const msg = 'Cannot save: Original canonical definition not loaded';
      setError(msg);
      throw new Error(msg);
    }
    
    // GUARD 2: Ensure layout exists
    if (!layout) {
      const msg = 'Cannot save: No layout to save';
      setError(msg);
      throw new Error(msg);
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // STEP 1: Apply layout changes to ORIGINAL canonical
      // (This preserves all accounting semantics)
      const updatedCanonical = applyLayoutToCanonical(originalCanonical, layout);
      
      // GUARD 3: Validate accounting semantics preserved
      validateNoForbiddenChanges(originalCanonical, updatedCanonical);
      
      // GUARD 4: Validate it's canonical, not layout
      assertNotLayout(updatedCanonical, 'pre-save');
      
      // GUARD 5: Force schemaVersion = 2
      if (updatedCanonical.schemaVersion !== 2) {
        throw new Error(
          `Fatal: Updated canonical has invalid schemaVersion: ${updatedCanonical.schemaVersion}`
        );
      }
      
      // STEP 2: Save CANONICAL to API (NOT layout)
      // Repository has additional guards
      await voucherTypeRepository.update(voucherCode, updatedCanonical);
      
      console.log('[DesignerV2] Saved canonical (layout discarded):', {
        code: updatedCanonical.code,
        schemaVersion: updatedCanonical.schemaVersion,
        layoutWasNeverSent: true
      });
      
      // STEP 3: REQUIRED - Discard layout (it's ephemeral)
      setLayout(null);
      
      // STEP 4: Reload to regenerate layout from saved canonical
      await loadVoucherDefinition();
      
      return true;
      
    } catch (err: any) {
      setError(err.message);
      console.error('[DesignerV2] Save error:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // =================================================================
  // GUARDS
  // =================================================================
  
  /**
   * Assert object is canonical VoucherTypeDefinition, NOT layout
   */
  function assertNotLayout(obj: any, context: string): void {
    // Check 1: Layout marker
    if ('__DO_NOT_PERSIST__' in obj) {
      throw new PersistenceViolationError(
        `Persistence violation (${context}): Attempted to persist VoucherLayoutV2. ` +
        `VoucherLayoutV2 is a view model and must never be saved.`
      );
    }
    
    // Check 2: Layout-specific properties
    if ('header' in obj || 'body' in obj || 'lines' in obj || 'actions' in obj) {
      throw new PersistenceViolationError(
        `Persistence violation (${context}): Object has layout properties (header/body/lines/actions). ` +
        `Only canonical VoucherTypeDefinition can be persisted.`
      );
    }
    
    // Check 3: Missing canonical properties
    if (!obj.headerFields || !Array.isArray(obj.headerFields)) {
      throw new PersistenceViolationError(
        `Persistence violation (${context}): Missing headerFields array. ` +
        `Expected canonical VoucherTypeDefinition.`
      );
    }
    
    if (!obj.tableColumns || !Array.isArray(obj.tableColumns)) {
      throw new PersistenceViolationError(
        `Persistence violation (${context}): Missing tableColumns array. ` +
        `Expected canonical VoucherTypeDefinition.`
      );
    }
    
    // Log for monitoring
    console.log('[DesignerV2] Persistence attempt validated:', {
      context,
      hasSchemaVersion: 'schemaVersion' in obj,
      schemaVersion: obj.schemaVersion,
      hasCanonicalProperties: true,
      isCanonical: true
    });
  }

  // =================================================================
  // RETURN
  // =================================================================
  
  return {
    // State
    originalCanonical,
    layout,
    loading,
    saving,
    error,
    
    // Actions
    setLayout, // For UI edits (ephemeral only)
    saveChanges,
    reload: loadVoucherDefinition,
    
    // Guards (exposed for testing)
    isLayoutPersistable: () => false, // Always false
    isCanonicalValid: () => originalCanonical?.schemaVersion === 2
  };
};

/**
 * Custom error for persistence violations
 */
export class PersistenceViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceViolationError';
    
    // Alert monitoring (this should NEVER happen in production)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage(
        'VoucherLayoutV2 persistence attempt blocked',
        {
          level: 'error',
          extra: { message }
        }
      );
    }
  }
}
