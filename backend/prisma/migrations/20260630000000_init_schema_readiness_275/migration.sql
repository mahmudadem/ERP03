-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "country" TEXT,
    "logoUrl" TEXT,
    "subscriptionPlan" TEXT,
    "contactInfo" JSONB,
    "baseCurrency" TEXT NOT NULL,
    "fiscalYearStart" TIMESTAMP(3) NOT NULL,
    "fiscalYearEnd" TIMESTAMP(3) NOT NULL,
    "modules" TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "globalRole" TEXT NOT NULL DEFAULT 'USER',
    "pictureUrl" TEXT,
    "planId" TEXT,
    "activeCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_users" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_users_pkey" PRIMARY KEY ("userId","companyId")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "strictApprovalMode" BOOLEAN NOT NULL DEFAULT false,
    "uiMode" TEXT NOT NULL DEFAULT 'windows',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "language" TEXT NOT NULL DEFAULT 'en',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 1,
    "fiscalYearEnd" INTEGER NOT NULL DEFAULT 12,
    "exchangeGainLossAccountId" TEXT,
    "disabledNotificationCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "uiMode" TEXT NOT NULL DEFAULT 'windows',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "sidebarMode" TEXT NOT NULL DEFAULT 'classic',
    "sidebarPinned" BOOLEAN NOT NULL DEFAULT true,
    "appearanceSettings" JSONB,
    "disabledNotificationCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificationCategoryOverrides" JSONB,
    "posShortcuts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_roles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleBundles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explicitPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_roles_pkey" PRIMARY KEY ("companyId","id")
);

-- CreateTable
CREATE TABLE "system_role_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bundleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_role_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "company_currencies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "company_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "systemCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountRole" TEXT NOT NULL DEFAULT 'POSTING',
    "classification" TEXT NOT NULL,
    "balanceNature" TEXT NOT NULL DEFAULT 'DEBIT',
    "balanceEnforcement" TEXT NOT NULL DEFAULT 'WARN_ABNORMAL',
    "parentId" TEXT,
    "currencyPolicy" TEXT NOT NULL DEFAULT 'INHERIT',
    "fixedCurrencyCode" TEXT,
    "allowedCurrencyCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "replacedByAccountId" TEXT,
    "cashFlowCategory" TEXT,
    "plSubgroup" TEXT,
    "equitySubgroup" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "requiresCustodyConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "custodianUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "voucherNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL,
    "totalDebit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "lockedBy" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "postingPeriodNo" INTEGER,
    "reversalOfVoucherId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fiscalYearId" TEXT,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_lines" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "side" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "costCenterId" TEXT,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "voucherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fiscalYearId" TEXT,
    "postingSeq" INTEGER NOT NULL DEFAULT 0,
    "reconciliationId" TEXT,
    "bankStatementLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "accountName" TEXT,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "lines" JSONB,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "matchedEntries" JSONB,
    "discrepancy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_voucher_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schedule" JSONB NOT NULL,
    "voucherData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_voucher_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "fiscalYearId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "companyId" TEXT,
    "reportingCurrency" TEXT NOT NULL DEFAULT 'USD',
    "members" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "barcodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uomBarcodes" JSONB,
    "uomBarcodeValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT NOT NULL DEFAULT 'PRODUCT',
    "categoryId" TEXT,
    "brand" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "baseUomId" TEXT,
    "baseUom" TEXT NOT NULL,
    "purchaseUomId" TEXT,
    "purchaseUom" TEXT,
    "salesUomId" TEXT,
    "salesUom" TEXT,
    "costCurrency" TEXT NOT NULL DEFAULT 'USD',
    "costingMethod" TEXT NOT NULL DEFAULT 'MOVING_AVG',
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "revenueAccountId" TEXT,
    "cogsAccountId" TEXT,
    "inventoryAssetAccountId" TEXT,
    "defaultPurchaseTaxCodeId" TEXT,
    "defaultSalesTaxCodeId" TEXT,
    "minStockLevel" DOUBLE PRECISION,
    "maxStockLevel" DOUBLE PRECISION,
    "reorderPoint" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "costingStats" JSONB,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uoms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT 'OTHER',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "translations" JSONB,
    "baseUomId" TEXT,
    "conversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uom_conversions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT,
    "fromUomId" TEXT NOT NULL,
    "toUomId" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qtyOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCostBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCostCCY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCostBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCostCCY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postingSeq" INTEGER NOT NULL DEFAULT 0,
    "maxBusinessDate" TEXT,
    "totalMovements" INTEGER NOT NULL DEFAULT 0,
    "lastMovementId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "postingSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceLineId" TEXT,
    "reversesMovementId" TEXT,
    "transferPairId" TEXT,
    "unitCostBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCostBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCostCCY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCostCCY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "movementCurrency" TEXT NOT NULL,
    "fxRateMovToBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fxRateCCYToBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fxRateKind" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "avgCostBaseAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCostCCYAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settledQty" DOUBLE PRECISION,
    "unsettledQty" DOUBLE PRECISION,
    "unsettledCostBasis" TEXT,
    "settlesNegativeQty" DOUBLE PRECISION,
    "newPositiveQty" DOUBLE PRECISION,
    "negativeQtyAtPosting" BOOLEAN NOT NULL DEFAULT false,
    "costSettled" BOOLEAN NOT NULL DEFAULT false,
    "isBackdated" BOOLEAN NOT NULL DEFAULT false,
    "costSource" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_lines" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qtyBefore" DOUBLE PRECISION NOT NULL,
    "qtyAfter" DOUBLE PRECISION NOT NULL,
    "unitCostBase" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "transferPairId" TEXT,
    "reversesTransferId" TEXT,
    "reversedByTransferId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "qtyReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stock_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opening_stock_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stock_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCostBase" DOUBLE PRECISION NOT NULL,
    "totalCostBase" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "opening_stock_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_period_snapshots" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "snapshotData" JSONB NOT NULL DEFAULT '[]',
    "totalValueBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_period_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_revaluations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "totalValueDeltaBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalValueDeltaCCY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voucherId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_revaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_revaluation_lines" (
    "id" TEXT NOT NULL,
    "revaluationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "qtyOnHand" DOUBLE PRECISION NOT NULL,
    "currentAvgCostBase" DOUBLE PRECISION NOT NULL,
    "currentAvgCostCCY" DOUBLE PRECISION NOT NULL,
    "newAvgCostBase" DOUBLE PRECISION NOT NULL,
    "newAvgCostCCY" DOUBLE PRECISION NOT NULL,
    "valueDeltaBase" DOUBLE PRECISION NOT NULL,
    "valueDeltaCCY" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,

    CONSTRAINT "inventory_revaluation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "internalNotes" TEXT,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "orderedQty" DOUBLE PRECISION NOT NULL,
    "uomId" TEXT,
    "uom" TEXT NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPriceDoc" DOUBLE PRECISION NOT NULL,
    "lineTotalDoc" DOUBLE PRECISION NOT NULL,
    "unitPriceBase" DOUBLE PRECISION NOT NULL,
    "lineTotalBase" DOUBLE PRECISION NOT NULL,
    "taxCodeId" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" TEXT,
    "description" TEXT,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "warehouseId" TEXT,
    "voucherId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "poLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "unitCostDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCostBase" DOUBLE PRECISION NOT NULL,
    "totalCostBase" DOUBLE PRECISION NOT NULL,
    "moveCurrency" TEXT NOT NULL DEFAULT 'USD',
    "fxRateMovToBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fxRateCCYToBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "stockMovementId" TEXT,
    "warehouseId" TEXT,
    "notes" TEXT,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT,
    "purchaseOrderId" TEXT,
    "goodsReceiptId" TEXT,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentTermsDays" INTEGER,
    "paidAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voucherType" TEXT,
    "voucherTypeId" TEXT,
    "voucherId" TEXT,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "attachments" JSONB DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "poLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "invoicedQty" DOUBLE PRECISION NOT NULL,
    "uomId" TEXT,
    "uom" TEXT NOT NULL,
    "unitPriceDoc" DOUBLE PRECISION NOT NULL,
    "lineTotalDoc" DOUBLE PRECISION NOT NULL,
    "unitPriceBase" DOUBLE PRECISION NOT NULL,
    "lineTotalBase" DOUBLE PRECISION NOT NULL,
    "taxCodeId" TEXT,
    "taxCode" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" TEXT,
    "description" TEXT,
    "grnLineId" TEXT,
    "accountId" TEXT,
    "stockMovementId" TEXT,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseInvoiceId" TEXT,
    "goodsReceiptId" TEXT,
    "purchaseOrderId" TEXT,
    "returnContext" TEXT NOT NULL DEFAULT 'DIRECT',
    "warehouseId" TEXT,
    "reason" TEXT,
    "voucherId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "returnQty" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "unitPriceDoc" DOUBLE PRECISION NOT NULL,
    "lineTotalDoc" DOUBLE PRECISION NOT NULL,
    "unitPriceBase" DOUBLE PRECISION NOT NULL,
    "lineTotalBase" DOUBLE PRECISION NOT NULL,
    "taxCodeId" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" TEXT,
    "description" TEXT,

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "internalNotes" TEXT,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "orderedQty" DOUBLE PRECISION NOT NULL,
    "uomId" TEXT,
    "uom" TEXT NOT NULL,
    "deliveredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPriceDoc" DOUBLE PRECISION NOT NULL,
    "lineTotalDoc" DOUBLE PRECISION NOT NULL,
    "unitPriceBase" DOUBLE PRECISION NOT NULL,
    "lineTotalBase" DOUBLE PRECISION NOT NULL,
    "taxCodeId" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" TEXT,
    "description" TEXT,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "warehouseId" TEXT,
    "cogsVoucherId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_lines" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "soLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "deliveredQty" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "unitCostBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineCostBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moveCurrency" TEXT NOT NULL DEFAULT 'USD',
    "fxRateMovToBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fxRateCCYToBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "stockMovementId" TEXT,
    "warehouseId" TEXT,
    "notes" TEXT,

    CONSTRAINT "delivery_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerInvoiceNumber" TEXT,
    "salesOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentTermsDays" INTEGER,
    "paidAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voucherType" TEXT,
    "voucherTypeId" TEXT,
    "voucherId" TEXT,
    "cogsVoucherId" TEXT,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "soLineId" TEXT,
    "dnLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "invoicedQty" DOUBLE PRECISION NOT NULL,
    "uomId" TEXT,
    "uom" TEXT NOT NULL,
    "unitPriceDoc" DOUBLE PRECISION NOT NULL,
    "lineTotalDoc" DOUBLE PRECISION NOT NULL,
    "unitPriceBase" DOUBLE PRECISION NOT NULL,
    "lineTotalBase" DOUBLE PRECISION NOT NULL,
    "taxCodeId" TEXT,
    "taxCode" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" TEXT,
    "revenueAccountId" TEXT NOT NULL,
    "cogsAccountId" TEXT,
    "inventoryAccountId" TEXT,
    "unitCostBase" DOUBLE PRECISION,
    "lineCostBase" DOUBLE PRECISION,
    "stockMovementId" TEXT,
    "description" TEXT,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesInvoiceId" TEXT,
    "deliveryNoteId" TEXT,
    "salesOrderId" TEXT,
    "returnContext" TEXT NOT NULL DEFAULT 'DIRECT',
    "reason" TEXT,
    "revenueVoucherId" TEXT,
    "cogsVoucherId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "returnQty" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "unitPriceDoc" DOUBLE PRECISION NOT NULL,
    "lineTotalDoc" DOUBLE PRECISION NOT NULL,
    "unitPriceBase" DOUBLE PRECISION NOT NULL,
    "lineTotalBase" DOUBLE PRECISION NOT NULL,
    "taxCodeId" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmountBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" TEXT,
    "description" TEXT,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "roles" TEXT[],
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "paymentTermsDays" INTEGER,
    "defaultCurrency" TEXT,
    "defaultAPAccountId" TEXT,
    "defaultARAccountId" TEXT,
    "vendorGroupId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_item_prices" (
    "companyId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lastSaleByCcyUom" JSONB,
    "lastPurchaseByCcyUom" JSONB,
    "contractSale" JSONB,
    "contractPurchase" JSONB,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "party_item_prices_pkey" PRIMARY KEY ("companyId","partyId","itemId")
);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'BOTH',
    "purchaseTaxAccountId" TEXT,
    "salesTaxAccountId" TEXT,
    "purchaseTaxTreatment" TEXT NOT NULL DEFAULT 'RECOVERABLE',
    "priceIsInclusive" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "department" TEXT,
    "departmentId" TEXT,
    "salary" DOUBLE PRECISION,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL,
    "logoutAt" TIMESTAMP(3),
    "method" TEXT NOT NULL,
    "location" TEXT,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_registers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "cashDrawerAccountId" TEXT NOT NULL,
    "settlementAccountIds" JSONB,
    "keyboardShortcuts" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_policies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "policy" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_shifts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "cashierUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL,
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "expectedCash" DOUBLE PRECISION,
    "countedCash" DOUBLE PRECISION,
    "expectedPaymentTotals" JSONB,
    "countedPaymentTotals" JSONB,
    "overShortPaymentTotals" JSONB,
    "overShortAmount" DOUBLE PRECISION,
    "overShortVoucherId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_cash_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_receipts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "lines" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesInvoiceId" TEXT,
    "salesInvoiceNumber" TEXT,
    "exchangeId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "changeGiven" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_held_carts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "cashierUserId" TEXT NOT NULL,
    "customerId" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "lines" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recalledAt" TIMESTAMP(3),
    "recalledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "pos_held_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_returns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "originalReceiptId" TEXT NOT NULL,
    "originalReceiptNumber" TEXT NOT NULL,
    "salesInvoiceId" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "refundMethod" TEXT NOT NULL,
    "refundTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesReturnId" TEXT,
    "salesReturnNumber" TEXT,
    "exchangeId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_definitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_type_definitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "headerFields" JSONB NOT NULL,
    "tableColumns" JSONB NOT NULL,
    "layout" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "requiredPostingRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workflow" JSONB,
    "uiModeOverrides" JSONB,
    "isMultiLine" BOOLEAN NOT NULL DEFAULT true,
    "rules" JSONB,
    "actions" JSONB,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_type_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_forms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voucherTypeId" TEXT NOT NULL,
    "formDefinitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleBundles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionUrl" TEXT,
    "sourceModule" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_module_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_module_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_permissions_definitions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_permissions_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_settings_definitions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "settingsSchema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_settings_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_domains" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_registries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "description" TEXT,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessDomainId" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft',
    "runtimeStatus" TEXT NOT NULL DEFAULT 'available',
    "implementationStatus" TEXT NOT NULL DEFAULT 'unchecked',
    "implementationError" TEXT,
    "implementationCheckedAt" TIMESTAMP(3),
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_capability_registries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft',
    "runtimeStatus" TEXT NOT NULL DEFAULT 'available',
    "implementationStatus" TEXT NOT NULL DEFAULT 'unchecked',
    "implementationError" TEXT,
    "implementationCheckedAt" TIMESTAMP(3),
    "enablementPolicy" TEXT NOT NULL DEFAULT 'platform_only',
    "requiresMigration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_capability_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_registries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft',
    "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricing" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_entitlements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_entitlement_items" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_entitlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_registries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "features" JSONB,
    "pricing" JSONB,
    "limits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_registries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_template_registries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_template_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "name" TEXT NOT NULL,
    "accounts" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_creation_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "data" JSONB NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_creation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_wizard_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "models" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_wizard_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_templates" (
    "id" TEXT NOT NULL,
    "industry" TEXT,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "categories" JSONB,
    "warehouses" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_modules" (
    "companyId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "initialized" BOOLEAN NOT NULL DEFAULT false,
    "initializationStatus" TEXT NOT NULL DEFAULT 'pending',
    "config" JSONB,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("companyId","moduleCode")
);

-- CreateTable
CREATE TABLE "company_capabilities" (
    "companyId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "company_capabilities_pkey" PRIMARY KEY ("companyId","capabilityId")
);

-- CreateTable
CREATE TABLE "system_metadata" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "amountBase" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "amountDoc" DOUBLE PRECISION NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "voucherId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "tokenCount" INTEGER,
    "metadata" JSONB,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "model" TEXT,
    "apiKey" TEXT,
    "apiEndpoint" TEXT,
    "maxTokensPerRequest" INTEGER,
    "maxRequestsPerDay" INTEGER,
    "dailyRequestCount" INTEGER NOT NULL DEFAULT 0,
    "dailyRequestDate" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT,
    "providerId" TEXT,
    "selectedModelProfileId" TEXT,
    "selectedProfileHash" TEXT,
    "conversationContextMode" TEXT,
    "includePreviousToolResults" BOOLEAN NOT NULL DEFAULT true,
    "runtimeMode" TEXT NOT NULL DEFAULT 'BYOK',
    "allowedRuntimeModes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorCode" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_profit_line_facts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentLineId" TEXT NOT NULL,
    "documentDate" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyBase" DOUBLE PRECISION NOT NULL,
    "uomId" TEXT NOT NULL,
    "docCurrency" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "exchangeRateDocToBase" DOUBLE PRECISION NOT NULL,
    "revenueAmountDoc" DOUBLE PRECISION NOT NULL,
    "revenueAmountBase" DOUBLE PRECISION NOT NULL,
    "revenueDir" TEXT,
    "costAmountDoc" DOUBLE PRECISION NOT NULL,
    "costAmountBase" DOUBLE PRECISION NOT NULL,
    "costDir" TEXT NOT NULL,
    "profitAmountDoc" DOUBLE PRECISION NOT NULL,
    "profitAmountBase" DOUBLE PRECISION NOT NULL,
    "profitDir" TEXT NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_profit_line_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "invoiceDate" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "commissionPct" DOUBLE PRECISION NOT NULL,
    "commissionAmountBase" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "accruedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_overrides" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "creditLimit" DOUBLE PRECISION NOT NULL,
    "currentExposure" DOUBLE PRECISION NOT NULL,
    "orderAmount" DOUBLE PRECISION NOT NULL,
    "projectedExposure" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenBy" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPriceListId" TEXT,
    "defaultPaymentTermsDays" INTEGER,
    "defaultCreditLimit" DOUBLE PRECISION,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_groups" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salespersons" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "defaultCommissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionPayableAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_price_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TEXT,
    "validTo" TEXT,
    "scope" TEXT NOT NULL,
    "itemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyXGetY" JSONB,
    "thresholdDiscount" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "salespersonId" TEXT,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originQuoteId" TEXT,
    "quoteDate" TEXT NOT NULL,
    "validUntil" TEXT,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "subtotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "convertedToType" TEXT,
    "convertedToId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoice_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceInvoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "maxOccurrences" INTEGER,
    "occurrencesGenerated" INTEGER NOT NULL DEFAULT 0,
    "nextGenerationDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceDocNumber" TEXT,
    "strategy" TEXT NOT NULL,
    "voucherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisions" JSONB NOT NULL DEFAULT '[]',
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idempotencyKey" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "postedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posting_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_lock_overrides" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "documentDate" TEXT NOT NULL,
    "lockedThroughDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenBy" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_lock_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_change_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityNumber" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("companyId","key")
);

-- CreateTable
CREATE TABLE "policy_configs" (
    "companyId" TEXT NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_configs_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "selling_policies" (
    "companyId" TEXT NOT NULL,
    "belowCostMode" TEXT NOT NULL DEFAULT 'REQUIRE_APPROVAL',
    "minMarginPercent" DOUBLE PRECISION,
    "allowManagerOverride" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selling_policies_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "pos_product_shortcut_layouts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_product_shortcut_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_product_shortcut_nodes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "parentId" TEXT,
    "nodeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secondaryLabel" TEXT,
    "itemId" TEXT,
    "variantId" TEXT,
    "unitId" TEXT,
    "predefinedQty" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_product_shortcut_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_control_button_layouts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_control_button_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_control_buttons" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "commandCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secondaryLabel" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiredPermission" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_control_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_layout_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_layout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_library_entries" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "companyId" TEXT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fieldClass" TEXT NOT NULL,
    "sectionHint" TEXT,
    "alwaysMandatory" BOOLEAN NOT NULL DEFAULT false,
    "alwaysShared" BOOLEAN NOT NULL DEFAULT false,
    "supportedTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectorBinding" TEXT,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_library_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications_settings" (
    "companyId" TEXT NOT NULL,
    "messagingAccounts" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_settings_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_taxId_key" ON "companies"("taxId");

-- CreateIndex
CREATE INDEX "companies_ownerId_idx" ON "companies"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_activeCompanyId_idx" ON "users"("activeCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_companyId_key" ON "company_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "company_roles_companyId_idx" ON "company_roles"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_roles_companyId_name_key" ON "company_roles"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "system_role_templates_code_key" ON "system_role_templates"("code");

-- CreateIndex
CREATE INDEX "company_currencies_companyId_idx" ON "company_currencies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_currencies_companyId_currencyCode_key" ON "company_currencies"("companyId", "currencyCode");

-- CreateIndex
CREATE INDEX "exchange_rates_companyId_fromCurrency_toCurrency_date_idx" ON "exchange_rates"("companyId", "fromCurrency", "toCurrency", "date");

-- CreateIndex
CREATE INDEX "exchange_rates_companyId_date_idx" ON "exchange_rates"("companyId", "date");

-- CreateIndex
CREATE INDEX "accounts_companyId_classification_idx" ON "accounts"("companyId", "classification");

-- CreateIndex
CREATE INDEX "accounts_companyId_status_idx" ON "accounts"("companyId", "status");

-- CreateIndex
CREATE INDEX "accounts_companyId_parentId_idx" ON "accounts"("companyId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_companyId_systemCode_key" ON "accounts"("companyId", "systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_companyId_userCode_key" ON "accounts"("companyId", "userCode");

-- CreateIndex
CREATE INDEX "vouchers_companyId_date_idx" ON "vouchers"("companyId", "date");

-- CreateIndex
CREATE INDEX "vouchers_companyId_status_idx" ON "vouchers"("companyId", "status");

-- CreateIndex
CREATE INDEX "vouchers_companyId_type_idx" ON "vouchers"("companyId", "type");

-- CreateIndex
CREATE INDEX "vouchers_companyId_voucherNo_idx" ON "vouchers"("companyId", "voucherNo");

-- CreateIndex
CREATE INDEX "vouchers_fiscalYearId_idx" ON "vouchers"("fiscalYearId");

-- CreateIndex
CREATE INDEX "vouchers_reversalOfVoucherId_idx" ON "vouchers"("reversalOfVoucherId");

-- CreateIndex
CREATE INDEX "voucher_lines_voucherId_idx" ON "voucher_lines"("voucherId");

-- CreateIndex
CREATE INDEX "voucher_lines_accountId_idx" ON "voucher_lines"("accountId");

-- CreateIndex
CREATE INDEX "voucher_lines_costCenterId_idx" ON "voucher_lines"("costCenterId");

-- CreateIndex
CREATE INDEX "ledger_entries_companyId_accountId_date_idx" ON "ledger_entries"("companyId", "accountId", "date");

-- CreateIndex
CREATE INDEX "ledger_entries_companyId_fiscalYearId_idx" ON "ledger_entries"("companyId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "ledger_entries_companyId_date_idx" ON "ledger_entries"("companyId", "date");

-- CreateIndex
CREATE INDEX "ledger_entries_voucherId_idx" ON "ledger_entries"("voucherId");

-- CreateIndex
CREATE INDEX "ledger_entries_reconciliationId_idx" ON "ledger_entries"("reconciliationId");

-- CreateIndex
CREATE INDEX "ledger_entries_bankStatementLineId_idx" ON "ledger_entries"("bankStatementLineId");

-- CreateIndex
CREATE INDEX "cost_centers_companyId_idx" ON "cost_centers"("companyId");

-- CreateIndex
CREATE INDEX "cost_centers_companyId_parentId_idx" ON "cost_centers"("companyId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_companyId_code_key" ON "cost_centers"("companyId", "code");

-- CreateIndex
CREATE INDEX "fiscal_years_companyId_idx" ON "fiscal_years"("companyId");

-- CreateIndex
CREATE INDEX "fiscal_years_companyId_status_idx" ON "fiscal_years"("companyId", "status");

-- CreateIndex
CREATE INDEX "budgets_companyId_fiscalYearId_idx" ON "budgets"("companyId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "budgets_companyId_status_idx" ON "budgets"("companyId", "status");

-- CreateIndex
CREATE INDEX "bank_statements_companyId_accountNo_idx" ON "bank_statements"("companyId", "accountNo");

-- CreateIndex
CREATE INDEX "bank_statements_companyId_statementDate_idx" ON "bank_statements"("companyId", "statementDate");

-- CreateIndex
CREATE INDEX "reconciliations_companyId_accountId_idx" ON "reconciliations"("companyId", "accountId");

-- CreateIndex
CREATE INDEX "reconciliations_companyId_period_idx" ON "reconciliations"("companyId", "period");

-- CreateIndex
CREATE INDEX "recurring_voucher_templates_companyId_idx" ON "recurring_voucher_templates"("companyId");

-- CreateIndex
CREATE INDEX "recurring_voucher_templates_companyId_isActive_idx" ON "recurring_voucher_templates"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "voucher_sequences_companyId_idx" ON "voucher_sequences"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_sequences_companyId_voucherType_fiscalYearId_key" ON "voucher_sequences"("companyId", "voucherType", "fiscalYearId");

-- CreateIndex
CREATE INDEX "company_groups_parentId_idx" ON "company_groups"("parentId");

-- CreateIndex
CREATE INDEX "company_groups_companyId_idx" ON "company_groups"("companyId");

-- CreateIndex
CREATE INDEX "items_companyId_idx" ON "items"("companyId");

-- CreateIndex
CREATE INDEX "items_companyId_type_idx" ON "items"("companyId", "type");

-- CreateIndex
CREATE INDEX "items_companyId_categoryId_idx" ON "items"("companyId", "categoryId");

-- CreateIndex
CREATE INDEX "items_companyId_active_idx" ON "items"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "items_companyId_code_key" ON "items"("companyId", "code");

-- CreateIndex
CREATE INDEX "item_categories_companyId_idx" ON "item_categories"("companyId");

-- CreateIndex
CREATE INDEX "item_categories_companyId_parentId_idx" ON "item_categories"("companyId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_companyId_code_key" ON "item_categories"("companyId", "code");

-- CreateIndex
CREATE INDEX "uoms_companyId_idx" ON "uoms"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "uoms_companyId_code_key" ON "uoms"("companyId", "code");

-- CreateIndex
CREATE INDEX "uom_conversions_companyId_idx" ON "uom_conversions"("companyId");

-- CreateIndex
CREATE INDEX "uom_conversions_itemId_idx" ON "uom_conversions"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "uom_conversions_companyId_itemId_fromUomId_toUomId_key" ON "uom_conversions"("companyId", "itemId", "fromUomId", "toUomId");

-- CreateIndex
CREATE INDEX "warehouses_companyId_idx" ON "warehouses"("companyId");

-- CreateIndex
CREATE INDEX "warehouses_companyId_active_idx" ON "warehouses"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_companyId_code_key" ON "warehouses"("companyId", "code");

-- CreateIndex
CREATE INDEX "stock_levels_companyId_itemId_idx" ON "stock_levels"("companyId", "itemId");

-- CreateIndex
CREATE INDEX "stock_levels_companyId_warehouseId_idx" ON "stock_levels"("companyId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_companyId_itemId_warehouseId_key" ON "stock_levels"("companyId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_itemId_postingSeq_idx" ON "stock_movements"("companyId", "itemId", "postingSeq");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_warehouseId_postingSeq_idx" ON "stock_movements"("companyId", "warehouseId", "postingSeq");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_referenceType_referenceId_idx" ON "stock_movements"("companyId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_date_idx" ON "stock_movements"("companyId", "date");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_costSettled_idx" ON "stock_movements"("companyId", "costSettled");

-- CreateIndex
CREATE INDEX "stock_adjustments_companyId_idx" ON "stock_adjustments"("companyId");

-- CreateIndex
CREATE INDEX "stock_adjustments_companyId_status_idx" ON "stock_adjustments"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_companyId_documentNo_key" ON "stock_adjustments"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_adjustmentId_idx" ON "stock_adjustment_lines"("adjustmentId");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_itemId_idx" ON "stock_adjustment_lines"("itemId");

-- CreateIndex
CREATE INDEX "stock_transfers_companyId_idx" ON "stock_transfers"("companyId");

-- CreateIndex
CREATE INDEX "stock_transfers_companyId_status_idx" ON "stock_transfers"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_companyId_documentNo_key" ON "stock_transfers"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_transferId_idx" ON "stock_transfer_lines"("transferId");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_itemId_idx" ON "stock_transfer_lines"("itemId");

-- CreateIndex
CREATE INDEX "opening_stock_documents_companyId_idx" ON "opening_stock_documents"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "opening_stock_documents_companyId_documentNo_key" ON "opening_stock_documents"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "opening_stock_lines_documentId_idx" ON "opening_stock_lines"("documentId");

-- CreateIndex
CREATE INDEX "opening_stock_lines_itemId_idx" ON "opening_stock_lines"("itemId");

-- CreateIndex
CREATE INDEX "inventory_period_snapshots_companyId_period_idx" ON "inventory_period_snapshots"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_period_snapshots_companyId_period_key" ON "inventory_period_snapshots"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_settings_companyId_key" ON "inventory_settings"("companyId");

-- CreateIndex
CREATE INDEX "inventory_revaluations_companyId_idx" ON "inventory_revaluations"("companyId");

-- CreateIndex
CREATE INDEX "inventory_revaluations_companyId_status_idx" ON "inventory_revaluations"("companyId", "status");

-- CreateIndex
CREATE INDEX "inventory_revaluations_companyId_date_idx" ON "inventory_revaluations"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_revaluations_companyId_documentNo_key" ON "inventory_revaluations"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "inventory_revaluation_lines_revaluationId_idx" ON "inventory_revaluation_lines"("revaluationId");

-- CreateIndex
CREATE INDEX "inventory_revaluation_lines_itemId_idx" ON "inventory_revaluation_lines"("itemId");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_idx" ON "purchase_orders"("companyId");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_vendorId_idx" ON "purchase_orders"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_status_idx" ON "purchase_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_orderDate_idx" ON "purchase_orders"("companyId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_companyId_orderNumber_key" ON "purchase_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "purchase_order_lines_orderId_idx" ON "purchase_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_itemId_idx" ON "purchase_order_lines"("itemId");

-- CreateIndex
CREATE INDEX "goods_receipts_companyId_idx" ON "goods_receipts"("companyId");

-- CreateIndex
CREATE INDEX "goods_receipts_companyId_purchaseOrderId_idx" ON "goods_receipts"("companyId", "purchaseOrderId");

-- CreateIndex
CREATE INDEX "goods_receipts_companyId_status_idx" ON "goods_receipts"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_companyId_documentNo_key" ON "goods_receipts"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_receiptId_idx" ON "goods_receipt_lines"("receiptId");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_itemId_idx" ON "goods_receipt_lines"("itemId");

-- CreateIndex
CREATE INDEX "purchase_invoices_companyId_idx" ON "purchase_invoices"("companyId");

-- CreateIndex
CREATE INDEX "purchase_invoices_companyId_vendorId_idx" ON "purchase_invoices"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "purchase_invoices_companyId_status_idx" ON "purchase_invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_companyId_invoiceDate_idx" ON "purchase_invoices"("companyId", "invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_companyId_invoiceNumber_key" ON "purchase_invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_invoiceId_idx" ON "purchase_invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_itemId_idx" ON "purchase_invoice_lines"("itemId");

-- CreateIndex
CREATE INDEX "purchase_returns_companyId_idx" ON "purchase_returns"("companyId");

-- CreateIndex
CREATE INDEX "purchase_returns_companyId_vendorId_idx" ON "purchase_returns"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "purchase_returns_companyId_status_idx" ON "purchase_returns"("companyId", "status");

-- CreateIndex
CREATE INDEX "purchase_returns_companyId_purchaseInvoiceId_idx" ON "purchase_returns"("companyId", "purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "purchase_returns_companyId_goodsReceiptId_idx" ON "purchase_returns"("companyId", "goodsReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_companyId_documentNo_key" ON "purchase_returns"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "purchase_return_lines_returnId_idx" ON "purchase_return_lines"("returnId");

-- CreateIndex
CREATE INDEX "purchase_return_lines_itemId_idx" ON "purchase_return_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_settings_companyId_key" ON "purchase_settings"("companyId");

-- CreateIndex
CREATE INDEX "sales_orders_companyId_idx" ON "sales_orders"("companyId");

-- CreateIndex
CREATE INDEX "sales_orders_companyId_customerId_idx" ON "sales_orders"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "sales_orders_companyId_status_idx" ON "sales_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "sales_orders_companyId_orderDate_idx" ON "sales_orders"("companyId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_companyId_orderNumber_key" ON "sales_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "sales_order_lines_orderId_idx" ON "sales_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "sales_order_lines_itemId_idx" ON "sales_order_lines"("itemId");

-- CreateIndex
CREATE INDEX "delivery_notes_companyId_idx" ON "delivery_notes"("companyId");

-- CreateIndex
CREATE INDEX "delivery_notes_companyId_salesOrderId_idx" ON "delivery_notes"("companyId", "salesOrderId");

-- CreateIndex
CREATE INDEX "delivery_notes_companyId_status_idx" ON "delivery_notes"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_companyId_documentNo_key" ON "delivery_notes"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "delivery_note_lines_deliveryId_idx" ON "delivery_note_lines"("deliveryId");

-- CreateIndex
CREATE INDEX "delivery_note_lines_itemId_idx" ON "delivery_note_lines"("itemId");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_idx" ON "sales_invoices"("companyId");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_customerId_idx" ON "sales_invoices"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_status_idx" ON "sales_invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_invoiceDate_idx" ON "sales_invoices"("companyId", "invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_companyId_invoiceNumber_key" ON "sales_invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_invoiceId_idx" ON "sales_invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_itemId_idx" ON "sales_invoice_lines"("itemId");

-- CreateIndex
CREATE INDEX "sales_returns_companyId_idx" ON "sales_returns"("companyId");

-- CreateIndex
CREATE INDEX "sales_returns_companyId_customerId_idx" ON "sales_returns"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "sales_returns_companyId_status_idx" ON "sales_returns"("companyId", "status");

-- CreateIndex
CREATE INDEX "sales_returns_companyId_salesInvoiceId_idx" ON "sales_returns"("companyId", "salesInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_companyId_documentNo_key" ON "sales_returns"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "sales_return_lines_returnId_idx" ON "sales_return_lines"("returnId");

-- CreateIndex
CREATE INDEX "sales_return_lines_itemId_idx" ON "sales_return_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_settings_companyId_key" ON "sales_settings"("companyId");

-- CreateIndex
CREATE INDEX "parties_companyId_idx" ON "parties"("companyId");

-- CreateIndex
CREATE INDEX "parties_companyId_active_idx" ON "parties"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "parties_companyId_code_key" ON "parties"("companyId", "code");

-- CreateIndex
CREATE INDEX "party_item_prices_companyId_partyId_idx" ON "party_item_prices"("companyId", "partyId");

-- CreateIndex
CREATE INDEX "party_item_prices_companyId_itemId_idx" ON "party_item_prices"("companyId", "itemId");

-- CreateIndex
CREATE INDEX "tax_codes_companyId_idx" ON "tax_codes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_companyId_code_key" ON "tax_codes"("companyId", "code");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "employees_companyId_active_idx" ON "employees"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_code_key" ON "employees"("companyId", "code");

-- CreateIndex
CREATE INDEX "attendance_companyId_employeeId_idx" ON "attendance"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "attendance_companyId_date_idx" ON "attendance"("companyId", "date");

-- CreateIndex
CREATE INDEX "pos_registers_companyId_idx" ON "pos_registers"("companyId");

-- CreateIndex
CREATE INDEX "pos_registers_companyId_status_idx" ON "pos_registers"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pos_registers_companyId_code_key" ON "pos_registers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pos_settings_companyId_key" ON "pos_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_policies_companyId_key" ON "pos_policies"("companyId");

-- CreateIndex
CREATE INDEX "pos_shifts_companyId_idx" ON "pos_shifts"("companyId");

-- CreateIndex
CREATE INDEX "pos_shifts_companyId_registerId_idx" ON "pos_shifts"("companyId", "registerId");

-- CreateIndex
CREATE INDEX "pos_shifts_companyId_cashierUserId_idx" ON "pos_shifts"("companyId", "cashierUserId");

-- CreateIndex
CREATE INDEX "pos_shifts_companyId_status_idx" ON "pos_shifts"("companyId", "status");

-- CreateIndex
CREATE INDEX "pos_shifts_companyId_openedAt_idx" ON "pos_shifts"("companyId", "openedAt");

-- CreateIndex
CREATE INDEX "pos_cash_movements_companyId_shiftId_idx" ON "pos_cash_movements"("companyId", "shiftId");

-- CreateIndex
CREATE INDEX "pos_cash_movements_companyId_registerId_idx" ON "pos_cash_movements"("companyId", "registerId");

-- CreateIndex
CREATE INDEX "pos_cash_movements_companyId_type_idx" ON "pos_cash_movements"("companyId", "type");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_idx" ON "pos_receipts"("companyId");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_shiftId_idx" ON "pos_receipts"("companyId", "shiftId");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_registerId_idx" ON "pos_receipts"("companyId", "registerId");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_customerId_idx" ON "pos_receipts"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_salesInvoiceId_idx" ON "pos_receipts"("companyId", "salesInvoiceId");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_exchangeId_idx" ON "pos_receipts"("companyId", "exchangeId");

-- CreateIndex
CREATE INDEX "pos_receipts_companyId_createdAt_idx" ON "pos_receipts"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pos_receipts_companyId_receiptNumber_key" ON "pos_receipts"("companyId", "receiptNumber");

-- CreateIndex
CREATE INDEX "pos_payments_companyId_receiptId_idx" ON "pos_payments"("companyId", "receiptId");

-- CreateIndex
CREATE INDEX "pos_held_carts_companyId_idx" ON "pos_held_carts"("companyId");

-- CreateIndex
CREATE INDEX "pos_held_carts_companyId_registerId_idx" ON "pos_held_carts"("companyId", "registerId");

-- CreateIndex
CREATE INDEX "pos_held_carts_companyId_shiftId_idx" ON "pos_held_carts"("companyId", "shiftId");

-- CreateIndex
CREATE INDEX "pos_held_carts_companyId_cashierUserId_idx" ON "pos_held_carts"("companyId", "cashierUserId");

-- CreateIndex
CREATE INDEX "pos_held_carts_companyId_status_idx" ON "pos_held_carts"("companyId", "status");

-- CreateIndex
CREATE INDEX "pos_held_carts_companyId_updatedAt_idx" ON "pos_held_carts"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "pos_returns_companyId_idx" ON "pos_returns"("companyId");

-- CreateIndex
CREATE INDEX "pos_returns_companyId_shiftId_idx" ON "pos_returns"("companyId", "shiftId");

-- CreateIndex
CREATE INDEX "pos_returns_companyId_originalReceiptId_idx" ON "pos_returns"("companyId", "originalReceiptId");

-- CreateIndex
CREATE INDEX "pos_returns_companyId_salesInvoiceId_idx" ON "pos_returns"("companyId", "salesInvoiceId");

-- CreateIndex
CREATE INDEX "pos_returns_companyId_exchangeId_idx" ON "pos_returns"("companyId", "exchangeId");

-- CreateIndex
CREATE INDEX "pos_returns_companyId_createdAt_idx" ON "pos_returns"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pos_returns_companyId_returnNumber_key" ON "pos_returns"("companyId", "returnNumber");

-- CreateIndex
CREATE INDEX "form_definitions_companyId_idx" ON "form_definitions"("companyId");

-- CreateIndex
CREATE INDEX "form_definitions_companyId_module_idx" ON "form_definitions"("companyId", "module");

-- CreateIndex
CREATE INDEX "voucher_type_definitions_companyId_idx" ON "voucher_type_definitions"("companyId");

-- CreateIndex
CREATE INDEX "voucher_type_definitions_companyId_module_idx" ON "voucher_type_definitions"("companyId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_type_definitions_companyId_code_module_key" ON "voucher_type_definitions"("companyId", "code", "module");

-- CreateIndex
CREATE INDEX "voucher_forms_companyId_idx" ON "voucher_forms"("companyId");

-- CreateIndex
CREATE INDEX "voucher_forms_voucherTypeId_idx" ON "voucher_forms"("voucherTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "notifications_companyId_idx" ON "notifications"("companyId");

-- CreateIndex
CREATE INDEX "notifications_companyId_createdAt_idx" ON "notifications"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "company_module_settings_companyId_idx" ON "company_module_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_module_settings_companyId_moduleId_key" ON "company_module_settings"("companyId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "module_permissions_definitions_moduleId_key" ON "module_permissions_definitions"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "module_settings_definitions_moduleId_key" ON "module_settings_definitions"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "business_domains_code_key" ON "business_domains"("code");

-- CreateIndex
CREATE UNIQUE INDEX "module_registries_code_key" ON "module_registries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "module_capability_registries_code_key" ON "module_capability_registries"("code");

-- CreateIndex
CREATE INDEX "module_capability_registries_moduleId_idx" ON "module_capability_registries"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_registries_code_key" ON "bundle_registries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_items_bundleId_itemKey_key" ON "bundle_items"("bundleId", "itemKey");

-- CreateIndex
CREATE INDEX "company_entitlements_companyId_idx" ON "company_entitlements"("companyId");

-- CreateIndex
CREATE INDEX "company_entitlements_companyId_isActive_idx" ON "company_entitlements"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "company_entitlement_items_entitlementId_itemKey_key" ON "company_entitlement_items"("entitlementId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "plan_registries_code_key" ON "plan_registries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_registries_code_key" ON "permission_registries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_template_registries_code_key" ON "role_template_registries"("code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_templates_code_idx" ON "chart_of_accounts_templates"("code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_templates_country_idx" ON "chart_of_accounts_templates"("country");

-- CreateIndex
CREATE INDEX "chart_of_accounts_templates_industry_idx" ON "chart_of_accounts_templates"("industry");

-- CreateIndex
CREATE INDEX "company_creation_sessions_userId_idx" ON "company_creation_sessions"("userId");

-- CreateIndex
CREATE INDEX "company_creation_sessions_status_idx" ON "company_creation_sessions"("status");

-- CreateIndex
CREATE INDEX "inventory_templates_industry_idx" ON "inventory_templates"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "system_metadata_key_key" ON "system_metadata"("key");

-- CreateIndex
CREATE INDEX "impersonation_sessions_superAdminId_idx" ON "impersonation_sessions"("superAdminId");

-- CreateIndex
CREATE INDEX "impersonation_sessions_companyId_idx" ON "impersonation_sessions"("companyId");

-- CreateIndex
CREATE INDEX "impersonation_sessions_active_idx" ON "impersonation_sessions"("active");

-- CreateIndex
CREATE INDEX "payment_history_companyId_idx" ON "payment_history"("companyId");

-- CreateIndex
CREATE INDEX "payment_history_companyId_sourceType_sourceId_idx" ON "payment_history"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "payment_history_companyId_paymentDate_idx" ON "payment_history"("companyId", "paymentDate");

-- CreateIndex
CREATE INDEX "ai_chat_messages_companyId_idx" ON "ai_chat_messages"("companyId");

-- CreateIndex
CREATE INDEX "ai_chat_messages_companyId_userId_conversationId_idx" ON "ai_chat_messages"("companyId", "userId", "conversationId");

-- CreateIndex
CREATE INDEX "ai_chat_messages_companyId_userId_conversationId_createdAt_idx" ON "ai_chat_messages"("companyId", "userId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_companyId_idx" ON "ai_usage_logs"("companyId");

-- CreateIndex
CREATE INDEX "ai_usage_logs_companyId_userId_idx" ON "ai_usage_logs"("companyId", "userId");

-- CreateIndex
CREATE INDEX "ai_usage_logs_companyId_createdAt_idx" ON "ai_usage_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_profit_line_facts_companyId_documentDate_idx" ON "sales_profit_line_facts"("companyId", "documentDate");

-- CreateIndex
CREATE INDEX "sales_profit_line_facts_companyId_documentId_idx" ON "sales_profit_line_facts"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "sales_profit_line_facts_companyId_itemId_documentDate_idx" ON "sales_profit_line_facts"("companyId", "itemId", "documentDate");

-- CreateIndex
CREATE INDEX "sales_profit_line_facts_companyId_documentType_documentDate_idx" ON "sales_profit_line_facts"("companyId", "documentType", "documentDate");

-- CreateIndex
CREATE INDEX "sales_profit_line_facts_companyId_status_idx" ON "sales_profit_line_facts"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_profit_line_facts_companyId_documentId_documentLineId_key" ON "sales_profit_line_facts"("companyId", "documentId", "documentLineId", "snapshotVersion");

-- CreateIndex
CREATE INDEX "commission_entries_companyId_salespersonId_idx" ON "commission_entries"("companyId", "salespersonId");

-- CreateIndex
CREATE INDEX "commission_entries_companyId_sourceType_sourceId_idx" ON "commission_entries"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "commission_entries_companyId_status_idx" ON "commission_entries"("companyId", "status");

-- CreateIndex
CREATE INDEX "commission_entries_companyId_invoiceDate_idx" ON "commission_entries"("companyId", "invoiceDate");

-- CreateIndex
CREATE INDEX "credit_overrides_companyId_customerId_idx" ON "credit_overrides"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "credit_overrides_companyId_sourceId_idx" ON "credit_overrides"("companyId", "sourceId");

-- CreateIndex
CREATE INDEX "credit_overrides_companyId_createdAt_idx" ON "credit_overrides"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_groups_companyId_status_idx" ON "customer_groups"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_companyId_name_key" ON "customer_groups"("companyId", "name");

-- CreateIndex
CREATE INDEX "vendor_groups_companyId_status_idx" ON "vendor_groups"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_groups_companyId_name_key" ON "vendor_groups"("companyId", "name");

-- CreateIndex
CREATE INDEX "salespersons_companyId_status_idx" ON "salespersons"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "salespersons_companyId_code_key" ON "salespersons"("companyId", "code");

-- CreateIndex
CREATE INDEX "price_lists_companyId_status_idx" ON "price_lists"("companyId", "status");

-- CreateIndex
CREATE INDEX "price_lists_companyId_currency_idx" ON "price_lists"("companyId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_companyId_name_key" ON "price_lists"("companyId", "name");

-- CreateIndex
CREATE INDEX "purchase_price_lists_companyId_status_idx" ON "purchase_price_lists"("companyId", "status");

-- CreateIndex
CREATE INDEX "purchase_price_lists_companyId_currency_idx" ON "purchase_price_lists"("companyId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_price_lists_companyId_name_key" ON "purchase_price_lists"("companyId", "name");

-- CreateIndex
CREATE INDEX "promotion_rules_companyId_status_priority_idx" ON "promotion_rules"("companyId", "status", "priority");

-- CreateIndex
CREATE INDEX "promotion_rules_companyId_type_idx" ON "promotion_rules"("companyId", "type");

-- CreateIndex
CREATE INDEX "quotes_companyId_status_idx" ON "quotes"("companyId", "status");

-- CreateIndex
CREATE INDEX "quotes_companyId_customerId_idx" ON "quotes"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "quotes_companyId_quoteDate_idx" ON "quotes"("companyId", "quoteDate");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_companyId_quoteNumber_key" ON "quotes"("companyId", "quoteNumber");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_companyId_status_idx" ON "recurring_invoice_templates"("companyId", "status");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_companyId_customerId_idx" ON "recurring_invoice_templates"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_companyId_nextGenerationDate_idx" ON "recurring_invoice_templates"("companyId", "nextGenerationDate");

-- CreateIndex
CREATE INDEX "posting_logs_companyId_sourceId_idx" ON "posting_logs"("companyId", "sourceId");

-- CreateIndex
CREATE INDEX "posting_logs_companyId_sourceModule_sourceType_idx" ON "posting_logs"("companyId", "sourceModule", "sourceType");

-- CreateIndex
CREATE INDEX "period_lock_overrides_companyId_sourceId_idx" ON "period_lock_overrides"("companyId", "sourceId");

-- CreateIndex
CREATE INDEX "period_lock_overrides_companyId_createdAt_idx" ON "period_lock_overrides"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "record_change_logs_companyId_entityType_entityId_idx" ON "record_change_logs"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "record_change_logs_companyId_timestamp_idx" ON "record_change_logs"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "record_change_logs_companyId_action_idx" ON "record_change_logs"("companyId", "action");

-- CreateIndex
CREATE INDEX "idempotency_keys_companyId_expiresAt_idx" ON "idempotency_keys"("companyId", "expiresAt");

-- CreateIndex
CREATE INDEX "pos_product_shortcut_layouts_companyId_idx" ON "pos_product_shortcut_layouts"("companyId");

-- CreateIndex
CREATE INDEX "pos_product_shortcut_nodes_companyId_layoutId_idx" ON "pos_product_shortcut_nodes"("companyId", "layoutId");

-- CreateIndex
CREATE INDEX "pos_control_button_layouts_companyId_idx" ON "pos_control_button_layouts"("companyId");

-- CreateIndex
CREATE INDEX "pos_control_buttons_companyId_layoutId_idx" ON "pos_control_buttons"("companyId", "layoutId");

-- CreateIndex
CREATE INDEX "print_layout_templates_companyId_documentType_idx" ON "print_layout_templates"("companyId", "documentType");

-- CreateIndex
CREATE INDEX "print_layout_templates_companyId_documentType_isDefault_idx" ON "print_layout_templates"("companyId", "documentType", "isDefault");

-- CreateIndex
CREATE INDEX "field_library_entries_scope_idx" ON "field_library_entries"("scope");

-- CreateIndex
CREATE INDEX "field_library_entries_companyId_scope_idx" ON "field_library_entries"("companyId", "scope");

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_roles" ADD CONSTRAINT "company_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_currencies" ADD CONSTRAINT "company_currencies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_currencies" ADD CONSTRAINT "company_currencies_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversalOfVoucherId_fkey" FOREIGN KEY ("reversalOfVoucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_voucher_templates" ADD CONSTRAINT "recurring_voucher_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_sequences" ADD CONSTRAINT "voucher_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_sequences" ADD CONSTRAINT "voucher_sequences_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_groups" ADD CONSTRAINT "company_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_groups" ADD CONSTRAINT "company_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_baseUomId_fkey" FOREIGN KEY ("baseUomId") REFERENCES "uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_purchaseUomId_fkey" FOREIGN KEY ("purchaseUomId") REFERENCES "uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_salesUomId_fkey" FOREIGN KEY ("salesUomId") REFERENCES "uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uoms" ADD CONSTRAINT "uoms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uoms" ADD CONSTRAINT "uoms_baseUomId_fkey" FOREIGN KEY ("baseUomId") REFERENCES "uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_fromUomId_fkey" FOREIGN KEY ("fromUomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_toUomId_fkey" FOREIGN KEY ("toUomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_documents" ADD CONSTRAINT "opening_stock_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "opening_stock_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_period_snapshots" ADD CONSTRAINT "inventory_period_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_revaluations" ADD CONSTRAINT "inventory_revaluations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_revaluation_lines" ADD CONSTRAINT "inventory_revaluation_lines_revaluationId_fkey" FOREIGN KEY ("revaluationId") REFERENCES "inventory_revaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_revaluation_lines" ADD CONSTRAINT "inventory_revaluation_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_settings" ADD CONSTRAINT "purchase_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_settings" ADD CONSTRAINT "sales_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_item_prices" ADD CONSTRAINT "party_item_prices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_item_prices" ADD CONSTRAINT "party_item_prices_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_item_prices" ADD CONSTRAINT "party_item_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_settings" ADD CONSTRAINT "pos_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_policies" ADD CONSTRAINT "pos_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_receipts" ADD CONSTRAINT "pos_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_type_definitions" ADD CONSTRAINT "voucher_type_definitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_forms" ADD CONSTRAINT "voucher_forms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_forms" ADD CONSTRAINT "voucher_forms_voucherTypeId_fkey" FOREIGN KEY ("voucherTypeId") REFERENCES "voucher_type_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_module_settings" ADD CONSTRAINT "company_module_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundle_registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_entitlement_items" ADD CONSTRAINT "company_entitlement_items_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "company_entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_profit_line_facts" ADD CONSTRAINT "sales_profit_line_facts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_overrides" ADD CONSTRAINT "credit_overrides_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_groups" ADD CONSTRAINT "vendor_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_price_lists" ADD CONSTRAINT "purchase_price_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_logs" ADD CONSTRAINT "posting_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_lock_overrides" ADD CONSTRAINT "period_lock_overrides_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_change_logs" ADD CONSTRAINT "record_change_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_configs" ADD CONSTRAINT "policy_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selling_policies" ADD CONSTRAINT "selling_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_product_shortcut_layouts" ADD CONSTRAINT "pos_product_shortcut_layouts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_product_shortcut_nodes" ADD CONSTRAINT "pos_product_shortcut_nodes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_control_button_layouts" ADD CONSTRAINT "pos_control_button_layouts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_control_buttons" ADD CONSTRAINT "pos_control_buttons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_layout_templates" ADD CONSTRAINT "print_layout_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications_settings" ADD CONSTRAINT "communications_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

