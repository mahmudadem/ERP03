import {
  ApprovalContext,
  ApprovalEngineResult,
  ApprovalSubject,
  IApprovalEngine,
} from '../contracts/IApprovalEngine';
import { ApprovalSubjectRegistry } from './ApprovalSubjectRegistry';

export class ApprovalEngine implements IApprovalEngine {
  constructor(private readonly registry = new ApprovalSubjectRegistry()) {}

  async evaluate(subject: ApprovalSubject, context: ApprovalContext): Promise<ApprovalEngineResult> {
    const plugin = this.registry.find(subject.type);
    if (plugin) {
      return plugin.evaluate(subject, context);
    }

    const payload = (subject.payload || {}) as any;
    const requiresApproval = payload.requiresApproval === true;
    return {
      decision: requiresApproval ? 'PENDING' : 'APPROVED',
      requiredApprovers: Array.isArray(payload.requiredApprovers) ? payload.requiredApprovers : [],
      gates: [{
        name: 'generic_subject',
        required: requiresApproval,
        metadata: { subjectType: subject.type },
      }],
    };
  }
}
