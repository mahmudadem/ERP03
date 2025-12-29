import { PostingPolicyContext, PolicyResult } from './PostingPolicyTypes';

/**
 * IPostingPolicy
 * 
 * Interface for pluggable accounting policies.
 * Policies are implemented as static code modules and enabled via configuration.
 * 
 * Policies NEVER write to ledger - they only allow/deny posting.
 */
export interface IPostingPolicy {
  /**
   * Unique identifier for this policy
   */
  readonly id: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Validates a posting attempt against this policy.
   * Returns success or structured failure.
   * 
   * @param ctx - Posting context with all necessary data
   * @returns PolicyResult indicating success or failure with details
   */
  validate(ctx: PostingPolicyContext): Promise<PolicyResult> | PolicyResult;
}
