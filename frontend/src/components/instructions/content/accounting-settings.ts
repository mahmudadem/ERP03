/**
 * Instructions Content: Accounting Settings Page
 * 
 * Provides contextual operational guidance for all tabs in the Accounting Settings.
 */

import { PageInstructions } from '../types';

/**
 * Tab: General Settings
 */
export const generalSettingsInstructions: PageInstructions = {
  pageId: 'accounting-settings-general',
  title: 'General Accounting Settings',
  overview: 'Configure core enterprise preferences that affect how data is recorded and displayed across the system.',
  sections: [
    {
      title: 'Timezone & Localization',
      content: 'The timezone setting determines how transaction timestamps are interpreted and stored. Changing this will affect the displayed dates of existing and future vouchers.',
    },
    {
      title: 'UI Mode (Classic vs Windows)',
      content: 'Choose between a standard web layout or a multi-window desktop experience. This is a personal preference that doesn\'t affect ledger data.',
    }
  ]
};

/**
 * Tab: Currencies
 */
export const currenciesInstructions: PageInstructions = {
  pageId: 'accounting-settings-currencies',
  title: 'Currency Configuration',
  overview: 'Manage the currencies your company accepts and define your primary ledger currency.',
  sections: [
    {
      title: 'Base Currency',
      content: 'The Base Currency is the "unit of account" for your entire company. All financial reports and ledger balances are calculated and stored in this currency.',
      warning: 'The Base Currency should be set once and rarely changed, as it defines your historical record parity.'
    },
    {
      title: 'Multi-Currency Support',
      content: 'Enabling additional currencies allows you to record transactions in those currencies. The system will track exchange rates relative to the Base Currency.'
    }
  ]
};

/**
 * Tab: Approval & Posting (Policies)
 */
export const policiesInstructions: PageInstructions = {
  pageId: 'accounting-settings-policies',
  title: 'Approval & Posting Policies',
  overview: 'Define the internal controls and "gates" that a voucher must pass through before it affects your ledger. Your choice here determines the balance between operational speed and audit-ready control.',
  sections: [
    {
      title: 'Workflow Modes (Flexible vs. Strict)',
      content: 
        'The system operates in two primary states based on the **Financial Approval (FA)** toggle:\n\n' +
        '• **Flexible Mode (Mode A - Fast Track):** When Financial Approval is **OFF**, the system is in "Flexible Mode." Vouchers post to the ledger immediately upon submission, and editing/deleting posted vouchers can be permitted. This is ideal for small teams or initial setup phases.\n\n' +
        '• **Strict Mode (Modes B, C, D - Audit Compliant):** When Financial Approval is **ON**, the system enforces a "Strict" workflow. Vouchers are held in a pending state and must clear all enabled gates before posting. Once posted in Strict Mode, vouchers become permanent records and can only be corrected via Reversals.',
    },
    {
      title: 'Approval Gates (FA & CC)',
      content: 
        '• **Financial Approval (FA):** The primary gate. Requires a manager with sufficient privileges to verify and "release" the voucher to the ledger. If FA is disabled, the system defaults to Auto-Post (Mode A).\n\n' +
        '• **Custody Confirmation (CC):** A secondary gate focused on the "physical" side of a transaction. For cash or warehouse accounts, the assigned custodian must confirm they have actually received or released the funds/assets before the voucher can proceed to financial approval.',
    },
    {
      title: 'Voucher Amount Threshold',
      content: 
        'The **Voucher Amount Threshold** is a "Smart Bypass" for the Custody gate. If a voucher\'s total value is below this defined amount, the system will automatically clear the Custody Confirmation step. This allows minor petty cash transactions to move directly to Financial Approval (or Posting) without requiring a physical confirmation from the custodian, reducing administrative friction for small amounts.',
    },
    {
      title: 'Immutability & Correction',
      content: 
        'In any workflow other than Mode A, posted vouchers are "locked." This prevents tampering with historical financial data. To fix an error, you must use the **Reversal (Storno)** button on the voucher to create an offsetting entry, ensuring a clean audit trail.',
      warning: 'Disabling Financial Approval later will not unlock vouchers that were posted while the "Strict" policy was active.'
    }
  ]
};

/**
 * Tab: Payment Methods
 */
export const paymentMethodsInstructions: PageInstructions = {
  pageId: 'accounting-settings-payment-methods',
  title: 'Payment Methods Management',
  overview: 'Define the available payment options for your transaction forms.',
  sections: [
    {
      title: 'Form Integration',
      content: 'Methods defined here appear in the "Payment Method" dropdown in the Voucher Editor. Disabling a method hides it from new forms but preserves it in historical data.',
    }
  ]
};

/**
 * Tab: Cost Center Required
 */
export const costCenterInstructions: PageInstructions = {
  pageId: 'accounting-settings-cost-center',
  title: 'Cost Center Enforcement',
  overview: 'Configure mandatory categorization of expenses and assets to departments or projects.',
  sections: [
    {
      title: 'Mandatory Assignment',
      content: 'When enabled for specific account types (e.g., Expense), the system will block any voucher submission that uses those accounts without a cost center assigned.',
    }
  ]
};

/**
 * Tab: Policy Error Mode
 */
export const errorModeInstructions: PageInstructions = {
  pageId: 'accounting-settings-error-mode',
  title: 'Validation & Error Reporting',
  overview: 'Control how the system reports policy violations during voucher entry.',
  sections: [
    {
      title: 'FAIL_FAST vs AGGREGATE',
      content: 
        '• **FAIL_FAST:** Stops at the first error. Best for quick corrections.\n' +
        '• **AGGREGATE:** Scans the entire voucher and lists all errors at once. Best for complex multi-line entries.',
    }
  ]
};

/**
 * Tab: Fiscal Year
 */
export const fiscalYearInstructions: PageInstructions = {
  pageId: 'accounting-settings-fiscal',
  title: 'Fiscal Year Definition',
  overview: 'Establish the 12-month reporting cycle for your enterprise.',
  sections: [
    {
      title: 'Reporting Periods',
      content: 'The fiscal year start defines your period boundaries. This affects financial statements, period closing, and data locking.',
    }
  ]
};

// Legacy Export (Maps to policies as fallback)
export const accountingSettingsInstructions = policiesInstructions;

