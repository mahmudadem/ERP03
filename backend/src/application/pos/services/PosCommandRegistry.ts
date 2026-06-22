import { PosCommandCode } from '../../../domain/pos/entities/PosLayout';

export type PosCommandExecutionMode = 'FRONTEND_UI' | 'BACKEND_COMMAND';

export interface PosCommandDefinition {
  code: PosCommandCode;
  defaultLabel: string;
  defaultIcon?: string;
  requiredPermission?: string;
  requiresActiveRegister?: boolean;
  requiresActiveShift?: boolean;
  requiresActiveCart?: boolean;
  executionMode: PosCommandExecutionMode;
}

export const POS_COMMAND_DEFINITIONS: Record<PosCommandCode, PosCommandDefinition> = {
  CUSTOMER_LOOKUP: {
    code: 'CUSTOMER_LOOKUP',
    defaultLabel: 'Customer',
    defaultIcon: 'user',
    executionMode: 'FRONTEND_UI',
  },
  PRINT_RECEIPT: {
    code: 'PRINT_RECEIPT',
    defaultLabel: 'Print',
    defaultIcon: 'printer',
    requiresActiveRegister: true,
    executionMode: 'BACKEND_COMMAND',
  },
  REPRINT_LAST_RECEIPT: {
    code: 'REPRINT_LAST_RECEIPT',
    defaultLabel: 'Reprint',
    defaultIcon: 'receipt',
    requiredPermission: 'pos.receipt.reprint',
    requiresActiveRegister: true,
    executionMode: 'BACKEND_COMMAND',
  },
  HOLD_SALE: {
    code: 'HOLD_SALE',
    defaultLabel: 'Hold',
    defaultIcon: 'archive',
    requiresActiveCart: true,
    executionMode: 'FRONTEND_UI',
  },
  RECALL_SALE: {
    code: 'RECALL_SALE',
    defaultLabel: 'Recall',
    defaultIcon: 'archive-restore',
    requiresActiveRegister: true,
    executionMode: 'FRONTEND_UI',
  },
  CLEAR_CART: {
    code: 'CLEAR_CART',
    defaultLabel: 'Clear',
    defaultIcon: 'trash',
    requiresActiveCart: true,
    executionMode: 'FRONTEND_UI',
  },
  VOID_LINE: {
    code: 'VOID_LINE',
    defaultLabel: 'Void line',
    defaultIcon: 'x-circle',
    requiresActiveCart: true,
    executionMode: 'FRONTEND_UI',
  },
  VOID_TICKET: {
    code: 'VOID_TICKET',
    defaultLabel: 'Void ticket',
    defaultIcon: 'ban',
    requiredPermission: 'pos.return.create',
    requiresActiveRegister: true,
    executionMode: 'FRONTEND_UI',
  },
  APPLY_DISCOUNT: {
    code: 'APPLY_DISCOUNT',
    defaultLabel: 'Discount',
    defaultIcon: 'tag',
    requiredPermission: 'pos.terminal.access',
    requiresActiveCart: true,
    executionMode: 'FRONTEND_UI',
  },
  PRICE_CHECK: {
    code: 'PRICE_CHECK',
    defaultLabel: 'Price check',
    defaultIcon: 'search',
    executionMode: 'FRONTEND_UI',
  },
  CASH_PAYMENT: {
    code: 'CASH_PAYMENT',
    defaultLabel: 'Cash',
    defaultIcon: 'banknote',
    requiresActiveCart: true,
    requiresActiveShift: true,
    executionMode: 'FRONTEND_UI',
  },
  CARD_PAYMENT: {
    code: 'CARD_PAYMENT',
    defaultLabel: 'Card',
    defaultIcon: 'credit-card',
    requiresActiveCart: true,
    requiresActiveShift: true,
    executionMode: 'FRONTEND_UI',
  },
  SPLIT_PAYMENT: {
    code: 'SPLIT_PAYMENT',
    defaultLabel: 'Split',
    defaultIcon: 'wallet',
    requiresActiveCart: true,
    requiresActiveShift: true,
    executionMode: 'FRONTEND_UI',
  },
  OPEN_CASH_DRAWER: {
    code: 'OPEN_CASH_DRAWER',
    defaultLabel: 'Open drawer',
    defaultIcon: 'unlock',
    requiredPermission: 'pos.cash.movement',
    requiresActiveRegister: true,
    requiresActiveShift: true,
    executionMode: 'BACKEND_COMMAND',
  },
  RETURN_REFUND: {
    code: 'RETURN_REFUND',
    defaultLabel: 'Return',
    defaultIcon: 'rotate-ccw',
    requiredPermission: 'pos.return.create',
    requiresActiveRegister: true,
    executionMode: 'FRONTEND_UI',
  },
  END_SHIFT: {
    code: 'END_SHIFT',
    defaultLabel: 'End shift',
    defaultIcon: 'log-out',
    requiredPermission: 'pos.shift.close',
    requiresActiveRegister: true,
    requiresActiveShift: true,
    executionMode: 'FRONTEND_UI',
  },
};

export class PosCommandRegistry {
  get(code: string): PosCommandDefinition {
    const definition = POS_COMMAND_DEFINITIONS[code as PosCommandCode];
    if (!definition) throw new Error(`Unknown POS command code: ${code}`);
    return definition;
  }

  list(): PosCommandDefinition[] {
    return Object.values(POS_COMMAND_DEFINITIONS);
  }
}
