import { useEffect, useState } from 'react';
import { inventoryApi, InventorySettingsDTO } from '../api/inventoryApi';
import { purchasesApi, PurchaseSettingsDTO } from '../api/purchasesApi';
import { salesApi, SalesSettingsDTO } from '../api/salesApi';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import {
  resolveInventoryAccountingMode,
  resolvePurchaseWorkflowMode,
  resolveSalesWorkflowMode,
  shouldShowOperationalDocuments,
} from '../utils/documentPolicy';

const unwrap = <T,>(payload: any): T => {
  const data = payload?.data ?? payload;
  return (data?.data ?? data) as T;
};

export const useDocumentPolicies = () => {
  const { moduleBundles, loading: accessLoading, permissionsLoaded } = useCompanyAccess();
  const activeModules = (moduleBundles || []).map((moduleId) => String(moduleId || '').trim().toLowerCase());
  const hasInventory = activeModules.includes('inventory');
  const hasSales = activeModules.includes('sales');
  const hasPurchase = activeModules.includes('purchase') || activeModules.includes('purchases');
  const canLoad = !accessLoading && permissionsLoaded;

  const [inventorySettings, setInventorySettings] = useState<InventorySettingsDTO | null>(null);
  const [salesSettings, setSalesSettings] = useState<SalesSettingsDTO | null>(null);
  const [purchaseSettings, setPurchaseSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!canLoad) {
        return;
      }

      if (!hasInventory && !hasSales && !hasPurchase) {
        setInventorySettings(null);
        setSalesSettings(null);
        setPurchaseSettings(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [inventoryResult, salesResult, purchaseResult] = await Promise.all([
          hasInventory ? inventoryApi.getSettings().catch(() => null) : Promise.resolve(null),
          hasSales ? salesApi.getSettings().catch(() => null) : Promise.resolve(null),
          hasPurchase ? purchasesApi.getSettings().catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setInventorySettings(inventoryResult ? unwrap<InventorySettingsDTO | null>(inventoryResult) : null);
        setSalesSettings(salesResult ? unwrap<SalesSettingsDTO | null>(salesResult) : null);
        setPurchaseSettings(purchaseResult ? unwrap<PurchaseSettingsDTO | null>(purchaseResult) : null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(canLoad);
    void load();

    return () => {
      cancelled = true;
    };
  }, [canLoad, hasInventory, hasSales, hasPurchase]);

  const accountingMode = resolveInventoryAccountingMode(inventorySettings);
  const salesWorkflowMode = resolveSalesWorkflowMode(salesSettings);
  const purchaseWorkflowMode = resolvePurchaseWorkflowMode(purchaseSettings);

  return {
    loading,
    inventorySettings,
    salesSettings,
    purchaseSettings,
    accountingMode,
    salesWorkflowMode,
    purchaseWorkflowMode,
    showSalesOperationalDocs: shouldShowOperationalDocuments(salesWorkflowMode),
    showPurchaseOperationalDocs: shouldShowOperationalDocuments(purchaseWorkflowMode),
  };
};
