/**
 * Instructions Content: Accounting Settings Page
 * 
 * Plain language operational guidance explaining:
 * - Strict vs Flexible modes
 * - Allow Edit/Delete Posted toggle
 * - Reversal workflow
 * - Warnings for irreversible actions
 */

import { PageInstructions } from '../types';

export const accountingSettingsInstructions: PageInstructions = {
  pageId: 'accounting-settings',
  title: 'How Accounting Settings Work',
  overview: 
    'These settings control how your accounting system handles voucher approval, ' +
    'posting, and modifications. Changes here affect the entire company and all users.',
  
  sections: [
    {
      title: 'Strict Mode vs Flexible Mode',
      content: 
        'Your system operates in one of two modes:\n\n' +
        '**Strict Mode** (Approval System ON):\n' +
        '• Vouchers must be submitted and approved before posting\n' +
        '• Once a voucher is posted, it becomes permanently immutable\n' +
        '• Posted vouchers can ONLY be corrected via Reversal\n' +
        '• This mode is designed for audit compliance\n\n' +
        '**Flexible Mode** (Approval System OFF):\n' +
        '• Submit equals approved – vouchers flow through without approval gates\n' +
        '• Posting still matters – it records transactions in the ledger\n' +
        '• Posted vouchers can be edited or deleted if the toggle is enabled',
      warning: 
        'Switching from Strict to Flexible mode does NOT unlock previously ' +
        'posted vouchers. Vouchers posted under Strict Mode remain immutable forever.',
    },
    {
      title: 'Allow Edit/Delete Posted',
      content: 
        'This toggle only applies in **Flexible Mode**.\n\n' +
        '**When OFF:**\n' +
        '• Posted vouchers cannot be edited or deleted\n' +
        '• Corrections must be made via Reversal\n' +
        '• This provides an audit trail while keeping flexibility\n\n' +
        '**When ON:**\n' +
        '• Posted vouchers CAN be edited (ledger entries are updated)\n' +
        '• Posted vouchers CAN be deleted (ledger entries are removed)\n' +
        '• This gives maximum administrative control',
      warning: 
        'Enabling this option allows direct modification of accounting history. ' +
        'There is no undo. The responsibility for data integrity lies entirely ' +
        'with the system administrator.',
    },
    {
      title: 'Reversal (Correction Workflow)',
      content: 
        'Reversal is the standard accounting method for correcting posted vouchers.\n\n' +
        '**How it works:**\n' +
        '• A reversal voucher is created with opposite debit/credit entries\n' +
        '• The original voucher remains unchanged (audit trail preserved)\n' +
        '• A replacement voucher can be created with correct data\n\n' +
        '**When Reversal is required:**\n' +
        '• Always in Strict Mode (no exceptions)\n' +
        '• In Flexible Mode when Allow Edit/Delete Posted is OFF\n\n' +
        '**Important:** Reversal uses actual ledger data from the original posting, ' +
        'not the voucher\'s current display data.',
      tip: 
        'Reversal is recommended even when direct editing is allowed, as it ' +
        'maintains a complete audit trail of all changes.',
    },
    {
      title: 'Other Settings',
      content: 
        '**Auto-Post When Approved:**\n' +
        '• When ON: Vouchers are posted to the ledger immediately upon approval\n' +
        '• When OFF: Approved vouchers wait for manual posting\n\n' +
        '**Period Lock:**\n' +
        '• Prevents posting to specific accounting periods\n' +
        '• Vouchers dated on or before the lock date cannot be modified',
    },
  ],
  
  footerWarnings: [
    'Changes to these settings take effect immediately for all users.',
    'Vouchers posted under Strict Mode are permanently locked – mode changes cannot unlock them.',
    'Disabling approvals does not delete the approval history of existing vouchers.',
  ],
};
