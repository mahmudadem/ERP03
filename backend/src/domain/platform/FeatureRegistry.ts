/**
 * FeatureRegistry.ts
 * 
 * Defines available features that can be enabled/disabled for companies
 */

export interface Feature {
    id: string;
    name: string;
    description: string;
}

export const Features: Record<string, Feature> = {
    'multiCurrency': {
        id: 'multiCurrency',
        name: 'Multi Currency',
        description: 'Enable multi-currency support'
    },
    'advancedReporting': {
        id: 'advancedReporting',
        name: 'Advanced Reporting',
        description: 'Unlock advanced reporting'
    },
    'apiAccess': {
        id: 'apiAccess',
        name: 'API Access',
        description: 'Access to public API'
    },
    'auditLogs': {
        id: 'auditLogs',
        name: 'Audit Logs',
        description: 'View system audit logs'
    },
    'customRoles': {
        id: 'customRoles',
        name: 'Custom Roles',
        description: 'Create custom roles'
    },
    'warehouseTracking': {
        id: 'warehouseTracking',
        name: 'Warehouse Tracking',
        description: 'Track inventory across warehouses'
    }
};
