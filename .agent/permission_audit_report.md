# Permission Audit Report
Generated: 2026-01-17

## Summary
This audit compares all permissions used in:
1. Backend routes (`permissionGuard()` calls)
2. Frontend routes (`requiredPermission` in routes.config.ts)
3. Frontend sidebar (`permission` in moduleMenuMap.ts and useSidebarConfig.ts)

Against what's seeded in Firestore (`seedOnboardingData.ts`).

---

## ACCOUNTING MODULE

### Backend Routes Check:
| Permission ID | Seeded? | Notes |
|---------------|---------|-------|
| `accounting.accounts.view` | ✅ | |
| `accounting.accounts.create` | ✅ | |
| `accounting.accounts.edit` | ✅ | |
| `accounting.accounts.delete` | ✅ | |
| `accounting.vouchers.view` | ✅ | |
| `accounting.vouchers.create` | ✅ | |
| `accounting.vouchers.edit` | ✅ | |
| `accounting.vouchers.delete` | ✅ | |
| `accounting.vouchers.approve` | ✅ | |
| `accounting.vouchers.post` | ✅ | |
| `accounting.vouchers.cancel` | ✅ | |
| `accounting.vouchers.correct` | ✅ | |
| `accounting.vouchers.lock` | ✅ | (commented out in routes but seeded) |
| `accounting.reports.profitAndLoss.view` | ✅ | |
| `accounting.reports.trialBalance.view` | ✅ | |
| `accounting.reports.generalLedger.view` | ✅ | |
| `accounting.designer.view` | ✅ | |
| `accounting.designer.create` | ✅ | |
| `accounting.designer.modify` | ✅ | |
| `accounting.settings.write` | ✅ | |
| `accounting.settings.view` | ✅ | |
| `accounting.settings.read` | ✅ | |
| `accounting.settings` | ✅ | (parent permission for hierarchical) |

### Frontend Routes/Sidebar Check:
| Permission ID | Seeded? | Notes |
|---------------|---------|-------|
| `accounting.settings.view` | ✅ | Used in routes.config.ts and moduleMenuMap.ts |
| `accounting.settings.manage` | ❌ MISSING | Used in useSidebarConfig.ts lines 95, 106 |

---

## INVENTORY MODULE

### Backend Routes Check:
| Permission ID | Seeded? | Notes |
|---------------|---------|-------|
| `inventory.items.create` | ❌ MISSING | Route uses this, seeded has `inventory.items.view` |
| `inventory.items.view` | ✅ | |
| `inventory.warehouses.create` | ❌ MISSING | Route uses this |

### Frontend Routes/Sidebar Check:
| Permission ID | Seeded? | Notes |
|---------------|---------|-------|
| `inventory.items.manage` | ❌ MISSING | Used in routes.config.ts |
| `item.list` | ❌ MISSING | Used in moduleMenuMap.ts |
| `warehouse.list` | ❌ MISSING | Used in moduleMenuMap.ts |
| `stockMovement.list` | ❌ MISSING | Used in moduleMenuMap.ts |
| `inventory.settings` | ❌ MISSING | Used in moduleMenuMap.ts |

---

## SYSTEM/SETTINGS

### Frontend Routes Check:
| Permission ID | Seeded? | Notes |
|---------------|---------|-------|
| `system.company.settings.manage` | ❌ MISSING | Used in routes.config.ts |
| `system.roles.manage` | ❌ MISSING | Used in routes.config.ts |

---

## OTHER MODULES (CRM, HR, POS, etc.)

### Mismatches Found:
| Permission Used | Seeded Permission | Notes |
|-----------------|-------------------|-------|
| `employee.list` | - | Used in frontend, not seeded |
| `attendance.list` | - | Used in frontend, not seeded |
| `payroll.list` | - | Used in frontend, not seeded |
| `sales.quotation.list` | - | Used in frontend, not seeded |
| `sales.invoice.list` | - | Used in frontend, not seeded |
| `customer.list` | - | Used in frontend, not seeded |
| `purchase.order.list` | - | Used in frontend, not seeded |
| `vendor.list` | - | Seeded as `vendor.list` ✅ |

---

## CRITICAL FIXES NEEDED

### 1. Add `accounting.settings.manage` to seeder
This is used by the sidebar for "Accounting Settings" link.

### 2. Add inventory permissions with correct IDs
- `inventory.items.create`
- `inventory.items.manage`
- `inventory.warehouses.create`
- `inventory.warehouses.view`

### 3. Add system permissions
- `system.company.settings.manage`
- `system.roles.manage`

---

## Recommended Action
Update `seedOnboardingData.ts` to include all missing permissions.
