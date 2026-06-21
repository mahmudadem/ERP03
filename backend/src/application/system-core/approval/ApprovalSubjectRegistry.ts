import {
  ApprovalContext,
  ApprovalEngineResult,
  ApprovalSubject,
  ApprovalSubjectType,
} from '../contracts/IApprovalEngine';

export interface ApprovalPlugin {
  readonly name: string;
  supports(type: ApprovalSubjectType): boolean;
  evaluate(subject: ApprovalSubject, context: ApprovalContext): Promise<ApprovalEngineResult>;
}

export class ApprovalSubjectRegistry {
  private readonly plugins: ApprovalPlugin[];

  constructor(plugins: ApprovalPlugin[] = []) {
    this.plugins = [...plugins];
  }

  register(plugin: ApprovalPlugin): void {
    this.plugins.push(plugin);
  }

  find(type: ApprovalSubjectType): ApprovalPlugin | undefined {
    return this.plugins.find((plugin) => plugin.supports(type));
  }
}
