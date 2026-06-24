import { PermissionChecker } from '../../rbac/PermissionChecker';
import { PosCommandCode } from '../../../domain/pos/entities/PosLayout';
import { PosCommandDefinition, PosCommandRegistry } from '../services/PosCommandRegistry';

export interface ExecutePosCommandInput {
  companyId: string;
  userId: string;
  commandCode: PosCommandCode;
  context: {
    saleId?: string;
    receiptId?: string;
    cartId?: string;
    branchId?: string;
    registerId?: string;
    shiftId?: string;
    customerId?: string;
    hasActiveCart?: boolean;
  };
}

export interface ExecutePosCommandResult {
  command: PosCommandDefinition;
  status: 'READY' | 'REJECTED';
  frontendAction?: string;
  backendAction?: string;
  message?: string;
  context: ExecutePosCommandInput['context'];
}

export class ExecutePosCommandUseCase {
  constructor(
    private readonly registry: PosCommandRegistry,
    private readonly permissionChecker?: PermissionChecker
  ) {}

  async execute(input: ExecutePosCommandInput): Promise<ExecutePosCommandResult> {
    const command = this.registry.get(input.commandCode);
    if (command.requiredPermission && this.permissionChecker) {
      await this.permissionChecker.assertOrThrow(input.userId, input.companyId, command.requiredPermission);
    }
    if (command.requiresActiveRegister && !input.context.registerId) {
      return this.reject(command, input.context, 'This command requires an active POS register.');
    }
    if (command.requiresActiveShift && !input.context.shiftId) {
      return this.reject(command, input.context, 'This command requires an open POS shift.');
    }
    if (command.requiresActiveCart && !input.context.hasActiveCart && !input.context.cartId) {
      return this.reject(command, input.context, 'This command requires an active cart.');
    }
    if (command.code === 'PRINT_RECEIPT' && !input.context.receiptId && !input.context.saleId) {
      return this.reject(command, input.context, 'A completed receipt is required before printing.');
    }
    return {
      command,
      status: 'READY',
      frontendAction: command.executionMode === 'FRONTEND_UI' ? command.code : undefined,
      backendAction: command.executionMode === 'BACKEND_COMMAND' ? command.code : undefined,
      context: input.context,
    };
  }

  private reject(command: PosCommandDefinition, context: ExecutePosCommandInput['context'], message: string): ExecutePosCommandResult {
    return {
      command,
      status: 'REJECTED',
      message,
      context,
    };
  }
}

export class ListPosCommandDefinitionsUseCase {
  constructor(private readonly registry: PosCommandRegistry) {}
  execute(): PosCommandDefinition[] {
    return this.registry.list();
  }
}
