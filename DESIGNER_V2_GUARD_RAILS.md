# Designer V2: Guard Rails Against VoucherLayoutV2 Persistence

## ⚠️ CRITICAL OBJECTIVE

**Prevent VoucherLayoutV2 from being persisted to database at all costs.**

VoucherLayoutV2 is ephemeral. Only canonical VoucherTypeDefinition (Schema V2) may be saved.

---

## 1. FORBIDDEN ACTIONS

### Explicit Prohibitions

| Action | Forbidden | Reason |
|--------|-----------|--------|
| **Save VoucherLayoutV2 to API** | ❌ BLOCKED | View model only, not canonical schema |
| **Store VoucherLayoutV2 in localStorage** | ❌ BLOCKED | No client-side persistence allowed |
| **Pass VoucherLayoutV2 to voucherTypeRepository** | ❌ BLOCKED | Repository accepts only canonical |
| **Serialize VoucherLayoutV2 to JSON for API** | ❌ BLOCKED | Must convert to canonical first |
| **Include VoucherLayoutV2 in any persistence payload** | ❌ BLOCKED | Contamination risk |
| **Cache VoucherLayoutV2 beyond component lifecycle** | ❌ BLOCKED | Must regenerate from canonical |

### Allowed Actions (Safe)

| Action | Allowed | Reason |
|--------|---------|--------|
| **Generate VoucherLayoutV2 from canonical** | ✅ SAFE | Read-only conversion |
| **Use VoucherLayoutV2 in React state** | ✅ SAFE | Component lifecycle only |
| **Pass VoucherLayoutV2 between components** | ✅ SAFE | Ephemeral UI state |
| **Rebuild canonical from layout + original** | ✅ SAFE | Safe conversion with validation |
| **Discard VoucherLayoutV2 after save** | ✅ REQUIRED | Must not persist |

---

## 2. PROTECTION LAYERS (Defense in Depth)

### Layer 1: Compile-Time (TypeScript)

**Location**: Type definitions

```typescript
// frontend/src/modules/accounting/designer-v2/types/VoucherLayoutV2.ts

/**
 * @deprecated for persistence
 * 
 * ⚠️ CRITICAL WARNING ⚠️
 * VoucherLayoutV2 is a UI VIEW MODEL ONLY.
 * 
 * DO NOT:
 * - Save to database
 * - Store in localStorage
 * - Send to API endpoints
 * - Cache beyond component lifecycle
 * 
 * This type intentionally lacks persistence methods.
 * Any attempt to persist will be blocked at runtime.
 * 
 * Use Flow:
 * 1. Load VoucherTypeDefinition (canonical)
 * 2. Generate VoucherLayoutV2 for rendering
 * 3. On save: Rebuild VoucherTypeDefinition
 * 4. Discard VoucherLayoutV2
 */
export interface VoucherLayoutV2 {
  // NOTE: This interface has no serialization methods
  // NOTE: This interface is not accepted by any repository
  
  id?: string;
  voucherType: VoucherTypeCode;
  // ... rest of view model properties
}

// Make it clear in the type system
export type PersistableVoucherType = VoucherTypeDefinition; // ✅ Can persist
export type EphemeralLayoutType = VoucherLayoutV2;          // ❌ Cannot persist
```

**Marker Type for Blocking**:

```typescript
// Mark VoucherLayoutV2 as non-persistable at type level
export interface VoucherLayoutV2 {
  readonly __DO_NOT_PERSIST__: never; // Compile-time marker
  // ... rest of interface
}

// Type guard that rejects layouts
export function isVoucherTypeDefinition(
  obj: any
): obj is VoucherTypeDefinition {
  return (
    typeof obj.schemaVersion === 'number' &&
    obj.schemaVersion === 2 &&
    !('__DO_NOT_PERSIST__' in obj)
  );
}
```

### Layer 2: Runtime Assertions (Design Pattern)

**Location**: Repository methods

```typescript
// frontend/src/modules/accounting/designer/repositories/VoucherTypeRepository.ts

export class VoucherTypeRepository implements IVoucherTypeRepository {
  
  async create(definition: VoucherTypeDefinition): Promise<VoucherTypeDefinition> {
    // GUARD: Block VoucherLayoutV2
    this.assertNotLayout(definition, 'create');
    
    // GUARD: Enforce Schema V2
    const payload = { ...definition, schemaVersion: 2 };
    validateSchemaV2(payload, 'create');
    
    const response = await client.post('/tenant/accounting/designer/voucher-types', payload);
    validateSchemaV2(response, 'create:response');
    return response;
  }
  
  async update(code: string, definition: VoucherTypeDefinition): Promise<void> {
    // GUARD: Block VoucherLayoutV2
    this.assertNotLayout(definition, 'update');
    
    // GUARD: Enforce Schema V2
    const payload = { ...definition, schemaVersion: 2 };
    validateSchemaV2(payload, `update:${code}`);
    
    await client.put(`/tenant/accounting/designer/voucher-types/${code}`, payload);
  }
  
  private assertNotLayout(obj: any, operation: string): void {
    // Check 1: Explicit marker
    if ('__DO_NOT_PERSIST__' in obj) {
      throw new PersistenceViolationError(
        `Attempted to ${operation} VoucherLayoutV2. ` +
        `VoucherLayoutV2 is a view model and cannot be persisted. ` +
        `Convert to VoucherTypeDefinition first.`
      );
    }
    
    // Check 2: Layout-specific properties
    if ('header' in obj || 'body' in obj || 'lines' in obj || 'actions' in obj) {
      throw new PersistenceViolationError(
        `Attempted to ${operation} a layout object. ` +
        `Only canonical VoucherTypeDefinition can be persisted.`
      );
    }
    
    // Check 3: Missing canonical properties
    if (!obj.headerFields || !obj.tableColumns) {
      throw new PersistenceViolationError(
        `Invalid object structure for ${operation}. ` +
        `Expected canonical VoucherTypeDefinition with headerFields and tableColumns.`
      );
    }
    
    // Log for monitoring
    this.logPersistenceAttempt(operation, obj);
  }
  
  private logPersistenceAttempt(operation: string, obj: any): void {
    console.log('[VoucherTypeRepository] Persistence attempt:', {
      operation,
      hasSchemaVersion: 'schemaVersion' in obj,
      schemaVersion: obj.schemaVersion,
      hasHeaderFields: 'headerFields' in obj,
      hasTableColumns: 'tableColumns' in obj,
      isLayoutObject: ('header' in obj || 'body' in obj),
      timestamp: new Date().toISOString()
    });
  }
}
```

### Layer 3: UI Component Guards

**Location**: Designer V2 save handler

```typescript
// frontend/src/modules/accounting/designer-v2/hooks/useDesignerV2.ts

export const useDesignerV2 = (code: string) => {
  const [originalCanonical, setOriginalCanonical] = useState<VoucherTypeDefinition | null>(null);
  const [layout, setLayout] = useState<VoucherLayoutV2 | null>(null);
  
  const handleSave = async () => {
    // GUARD 1: Ensure we have original canonical
    if (!originalCanonical) {
      throw new Error('Cannot save: Original canonical definition not loaded');
    }
    
    // GUARD 2: Ensure we have layout
    if (!layout) {
      throw new Error('Cannot save: No layout to save');
    }
    
    // GUARD 3: Never pass layout directly to repository
    // Instead, rebuild canonical from layout
    const updatedCanonical = rebuildCanonicalFromLayout(
      originalCanonical,
      layout
    );
    
    // GUARD 4: Validate canonical before save
    if (updatedCanonical.schemaVersion !== 2) {
      throw new Error('Fatal: Rebuilt canonical has invalid schemaVersion');
    }
    
    // GUARD 5: Double-check it's not a layout object
    if ('header' in updatedCanonical || 'body' in updatedCanonical) {
      throw new Error('Fatal: Attempted to save layout object instead of canonical');
    }
    
    // SAFE: Save canonical (repository has additional guards)
    await voucherTypeRepository.update(code, updatedCanonical);
    
    // REQUIRED: Discard layout after save
    setLayout(null);
  };
  
  return { layout, handleSave };
};
```

### Layer 4: API Client Interceptor

**Location**: Axios client

```typescript
// frontend/src/api/client.ts

import axios from 'axios';

const client = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
});

// Request interceptor: Block layouts at API boundary
client.interceptors.request.use(
  (config) => {
    // Check if request body looks like a VoucherLayoutV2
    if (config.data && config.url?.includes('/voucher-types')) {
      const data = config.data;
      
      // GUARD: Block layout objects
      if (data.header || data.body || data.lines || data.actions) {
        const error = new Error(
          'API_VIOLATION: Attempted to send VoucherLayoutV2 to API. ' +
          'Only VoucherTypeDefinition (Schema V2) is accepted.'
        );
        
        // Log critical violation
        console.error('[API Client] VoucherLayoutV2 persistence blocked:', {
          url: config.url,
          method: config.method,
          hasLayoutProperties: {
            header: !!data.header,
            body: !!data.body,
            lines: !!data.lines,
            actions: !!data.actions
          },
          timestamp: new Date().toISOString()
        });
        
        return Promise.reject(error);
      }
      
      // GUARD: Require schemaVersion = 2
      if (data.schemaVersion !== 2) {
        const error = new Error(
          'API_VIOLATION: Schema version must be 2. ' +
          `Received: ${data.schemaVersion}`
        );
        
        console.error('[API Client] Invalid schema version:', {
          url: config.url,
          schemaVersion: data.schemaVersion
        });
        
        return Promise.reject(error);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

export default client;
```

### Layer 5: Backend Validation (Final Defense)

**Location**: Backend API controller

```typescript
// backend/src/api/controllers/designer/DesignerController.ts

static async createVoucherType(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body;
    
    // GUARD: Reject layout objects
    if (payload.header || payload.body || payload.lines || payload.actions) {
      logger.error('[DesignerController] VoucherLayoutV2 persistence attempt blocked', {
        companyId: req.context.companyId,
        userId: req.context.userId,
        hasLayoutProps: {
          header: !!payload.header,
          body: !!payload.body,
          lines: !!payload.lines,
          actions: !!payload.actions
        },
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'VoucherLayoutV2 cannot be persisted. Send VoucherTypeDefinition (Schema V2) instead.',
        code: 'LAYOUT_PERSISTENCE_FORBIDDEN'
      });
    }
    
    // Convert to domain entity (validates Schema V2)
    const definition = VoucherTypeDefinitionMapper.toDomain(payload);
    
    // Use case validates again
    await diContainer.designerUseCases.createVoucherType(definition);
    
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
}
```

---

## 3. ERROR MESSAGES

### User-Facing Errors

```typescript
export const DESIGNER_V2_ERROR_MESSAGES = {
  LAYOUT_PERSISTENCE_BLOCKED: {
    title: 'Cannot Save Layout Object',
    message: 'The system detected an attempt to save a layout configuration instead of a voucher definition. This is a programming error. Please reload the page and try again.',
    severity: 'error',
    actions: ['Reload Page', 'Contact Support']
  },
  
  INVALID_SCHEMA_VERSION: {
    title: 'Invalid Schema Version',
    message: 'Only Schema V2 voucher definitions can be saved. This definition appears to be using an older format.',
    severity: 'error',
    actions: ['Reload Definition', 'Contact Administrator']
  },
  
  MISSING_CANONICAL_DEFINITION: {
    title: 'Missing Original Definition',
    message: 'Cannot save changes because the original voucher definition was not loaded properly. Please reload the page.',
    severity: 'error',
    actions: ['Reload Page']
  },
  
  FATAL_CONVERSION_ERROR: {
    title: 'Conversion Error',
    message: 'Failed to convert layout changes to voucher definition. This may indicate corrupted data. Your changes have not been saved.',
    severity: 'error',
    actions: ['Reload Page', 'Report Bug']
  }
};
```

### Developer Errors (Console)

```typescript
const DEV_ERROR_MESSAGES = {
  LAYOUT_IN_REPOSITORY: 
    'FATAL: VoucherLayoutV2 passed to repository. ' +
    'This is a programming error. VoucherLayoutV2 must be converted to ' +
    'VoucherTypeDefinition before saving. Check your save handler.',
  
  LAYOUT_IN_API_CLIENT:
    'FATAL: VoucherLayoutV2 detected in API request. ' +
    'API client blocked this request to prevent data corruption. ' +
    'Ensure all saves use VoucherTypeDefinition (Schema V2).',
  
  MISSING_CONVERSION:
    'ERROR: Save handler did not convert VoucherLayoutV2 to canonical. ' +
    'Review rebuildCanonicalFromLayout() implementation.',
  
  WRONG_OBJECT_TYPE:
    'ERROR: Expected VoucherTypeDefinition but received object with ' +
    'layout properties (header, body, lines, actions). ' +
    'This indicates incorrect data flow in Designer V2.'
};
```

---

## 4. LOGGING REQUIREMENTS

### Log Events

```typescript
enum VoucherPersistenceEvent {
  LAYOUT_BLOCKED_REPOSITORY = 'voucher.layout.blocked.repository',
  LAYOUT_BLOCKED_API = 'voucher.layout.blocked.api',
  LAYOUT_BLOCKED_BACKEND = 'voucher.layout.blocked.backend',
  CANONICAL_SAVED_SUCCESS = 'voucher.canonical.saved.success',
  CONVERSION_ERROR = 'voucher.conversion.error',
  SCHEMA_VALIDATION_FAILED = 'voucher.schema.validation.failed'
}
```

### Log Structure

```typescript
interface VoucherPersistenceLog {
  event: VoucherPersistenceEvent;
  timestamp: string;
  userId?: string;
  companyId?: string;
  voucherCode?: string;
  
  // Context
  layer: 'ui' | 'repository' | 'api-client' | 'backend';
  operation: 'create' | 'update' | 'load';
  
  // Detection details
  detectedIssue?: {
    hasLayoutProperties: boolean;
    hasCanonicalProperties: boolean;
    schemaVersion?: number;
    missingProperties: string[];
  };
  
  // Action taken
  action: 'blocked' | 'allowed' | 'error';
  errorMessage?: string;
  
  // Stack trace (for debugging)
  stackTrace?: string;
}
```

### Logging Implementation

```typescript
// frontend/src/utils/voucherPersistenceLogger.ts

export class VoucherPersistenceLogger {
  static log(log: VoucherPersistenceLog): void {
    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[VoucherPersistence]', log);
    }
    
    // Send to analytics in production
    if (log.action === 'blocked' || log.action === 'error') {
      analytics.track(log.event, {
        ...log,
        severity: log.action === 'blocked' ? 'warning' : 'error'
      });
    }
    
    // Critical: Alert if Designer V2 attempts layout persistence
    if (log.event === VoucherPersistenceEvent.LAYOUT_BLOCKED_REPOSITORY ||
        log.event === VoucherPersistenceEvent.LAYOUT_BLOCKED_API) {
      
      // This should NEVER happen in production
      Sentry.captureMessage('VoucherLayoutV2 persistence attempt detected', {
        level: 'error',
        extra: log
      });
    }
  }
  
  static logBlockedLayout(
    layer: VoucherPersistenceLog['layer'],
    operation: VoucherPersistenceLog['operation'],
    obj: any
  ): void {
    this.log({
      event: this.getEventForLayer(layer),
      timestamp: new Date().toISOString(),
      layer,
      operation,
      detectedIssue: {
        hasLayoutProperties: !!(obj.header || obj.body || obj.lines || obj.actions),
        hasCanonicalProperties: !!(obj.headerFields && obj.tableColumns),
        schemaVersion: obj.schemaVersion,
        missingProperties: this.getMissingCanonicalProperties(obj)
      },
      action: 'blocked',
      errorMessage: 'VoucherLayoutV2 persistence attempt blocked',
      stackTrace: new Error().stack
    });
  }
  
  private static getEventForLayer(layer: string): VoucherPersistenceEvent {
    switch (layer) {
      case 'repository': return VoucherPersistenceEvent.LAYOUT_BLOCKED_REPOSITORY;
      case 'api-client': return VoucherPersistenceEvent.LAYOUT_BLOCKED_API;
      case 'backend': return VoucherPersistenceEvent.LAYOUT_BLOCKED_BACKEND;
      default: return VoucherPersistenceEvent.LAYOUT_BLOCKED_REPOSITORY;
    }
  }
  
  private static getMissingCanonicalProperties(obj: any): string[] {
    const required = ['id', 'companyId', 'code', 'module', 'headerFields', 'tableColumns', 'schemaVersion'];
    return required.filter(prop => !(prop in obj));
  }
}
```

---

## 5. CHECKLIST: Implementation Verification

### Compile-Time Protections

- [ ] VoucherLayoutV2 has `@deprecated for persistence` JSDoc comment
- [ ] VoucherLayoutV2 has `__DO_NOT_PERSIST__: never` marker property
- [ ] Type guard `isVoucherTypeDefinition()` rejects layouts
- [ ] All save methods only accept `VoucherTypeDefinition` type

### Runtime Protections

- [ ] `VoucherTypeRepository.assertNotLayout()` checks for layout properties
- [ ] `VoucherTypeRepository.assertNotLayout()` checks for marker property
- [ ] `VoucherTypeRepository.assertNotLayout()` checks for canonical properties
- [ ] Designer V2 hook validates object before save
- [ ] Designer V2 hook discards layout after successful save

### API Boundary Protections

- [ ] Axios interceptor checks request body for layout properties
- [ ] Axios interceptor validates `schemaVersion === 2`
- [ ] Axios interceptor logs and rejects invalid payloads
- [ ] Backend controller checks for layout properties
- [ ] Backend controller returns 400 with clear error code

### Error Handling

- [ ] User-facing error messages defined and clear
- [ ] Developer console errors include diagnostic info
- [ ] Appropriate error severity levels set
- [ ] Error messages suggest recovery actions

### Logging

- [ ] All blocked attempts are logged
- [ ] Logs include sufficient context for debugging
- [ ] Critical violations sent to error monitoring (Sentry)
- [ ] Analytics track persistence patterns
- [ ] Stack traces captured for debugging

---

## 6. TESTING STRATEGY

### Unit Tests

```typescript
describe('VoucherLayoutV2 Persistence Guards', () => {
  
  it('should reject VoucherLayoutV2 in repository.create()', () => {
    const layout = {
      header: { fields: [] },
      body: { fields: [] },
      lines: { type: 'table' },
      actions: { buttons: [] }
    };
    
    expect(() => {
      voucherTypeRepository.create(layout as any);
    }).toThrow('VoucherLayoutV2 is a view model and cannot be persisted');
  });
  
  it('should accept canonical VoucherTypeDefinition', () => {
    const canonical = {
      id: 'test',
      companyId: 'comp1',
      code: 'PAYMENT',
      module: 'ACCOUNTING',
      headerFields: [],
      tableColumns: [],
      schemaVersion: 2
    };
    
    expect(() => {
      voucherTypeRepository.create(canonical);
    }).not.toThrow();
  });
  
  it('should reject objects with __DO_NOT_PERSIST__ marker', () => {
    const marked = {
      __DO_NOT_PERSIST__: undefined as never,
      headerFields: [],
      tableColumns: []
    };
    
    expect(() => {
      voucherTypeRepository.create(marked as any);
    }).toThrow('VoucherLayoutV2');
  });
});
```

### Integration Tests

```typescript
describe('Designer V2 Save Flow', () => {
  
  it('should convert layout to canonical before save', async () => {
    const originalCanonical = loadCanonicalDefinition();
    const layout = convertToVoucherLayout(originalCanonical);
    
    // User edits layout
    layout.body.fields[0].label = 'Updated Label';
    
    // Save should rebuild canonical, not save layout
    const saveHandler = new DesignerV2SaveHandler(originalCanonical);
    await saveHandler.saveLayoutChanges(layout);
    
    // Verify API received canonical, not layout
    expect(apiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headerFields: expect.any(Array),
        tableColumns: expect.any(Array),
        schemaVersion: 2
      })
    );
    
    expect(apiMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.anything(),
        body: expect.anything()
      })
    );
  });
});
```

---

## Summary

**5 Layers of Defense**:
1. ✅ Compile-time (TypeScript types, JSDoc warnings)
2. ✅ Runtime (Repository assertions)
3. ✅ UI Component (Save handler validation)
4. ✅ API Client (Request interceptor)
5. ✅ Backend (Controller validation)

**Key Guarantees**:
- VoucherLayoutV2 **CANNOT** reach the database
- Clear error messages at every layer
- Comprehensive logging for monitoring
- Early detection prevents data corruption

**If all layers fail**: Backend is final defense and will reject with 400 error.

No VoucherLayoutV2 can be persisted.
