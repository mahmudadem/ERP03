/**
 * policyConfig.validators.ts — request validation for the engine-owned
 * typed `PolicyConfig`.
 *
 * Task 267-D (Engine Management API Doorways): the same `PolicyConfig`
 * document is read/written by every module's policy doorway (POS, Sales,
 * Purchases) and by the company-wide settings doorway. The validator lives
 * in a neutral location (NOT under any module) so:
 *
 *   - POS does not import Sales validators/controllers.
 *   - Sales does not import POS / Purchases validators/controllers.
 *   - Purchases does not import POS / Sales validators/controllers.
 *
 * The validator is purely shape/structure — it does not call any module
 * business logic. Module-local filtering (e.g. a POS doorway that should
 * only accept rules with `module: 'pos'`) is done in the controller, not
 * here, so the validator stays neutral and reusable.
 */
import { ApiError } from '../errors/ApiError';

const POLICY_EFFECTS = ['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL'] as const;
const POLICY_SCOPES = ['TENANT', 'MODULE', 'ROLE', 'USER', 'CONTEXT'] as const;
const AMOUNT_OPS = ['>', '>=', '<', '<=', '==', '!='] as const;

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

const requireString = (value: unknown, field: string): string => {
  if (!isNonEmptyString(value)) {
    throw ApiError.badRequest(`${field} is required`);
  }
  return value.trim();
};

const optionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`${field} must be a string`);
  }
  return value.trim() || undefined;
};

const optionalBoolean = (value: unknown, field: string): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw ApiError.badRequest(`${field} must be a boolean`);
  }
  return value;
};

const optionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw ApiError.badRequest(`${field} must be a number`);
  }
  return n;
};

const optionalStringArray = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw ApiError.badRequest(`${field} must be an array`);
  }
  for (const item of value) {
    if (typeof item !== 'string') {
      throw ApiError.badRequest(`${field} must contain only strings`);
    }
  }
  return value as string[];
};

const validateAmountCondition = (cond: any, index: number): void => {
  const field = `rules[${index}].conditions.amount`;
  if (!cond || typeof cond !== 'object') {
    throw ApiError.badRequest(`${field} must be an object`);
  }
  const op = cond.op;
  if (!AMOUNT_OPS.includes(op)) {
    throw ApiError.badRequest(`${field}.op must be one of: ${AMOUNT_OPS.join(', ')}`);
  }
  if (cond.value === undefined || cond.value === null || !Number.isFinite(Number(cond.value))) {
    throw ApiError.badRequest(`${field}.value must be a finite number`);
  }
};

const validateMatchCondition = (cond: any, index: number): void => {
  const field = `rules[${index}].conditions.match`;
  if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
    throw ApiError.badRequest(`${field} must be an object`);
  }
  for (const [key, expected] of Object.entries(cond)) {
    if (typeof expected !== 'string' && !Array.isArray(expected)) {
      throw ApiError.badRequest(`${field}.${key} must be a string or an array of strings`);
    }
    if (Array.isArray(expected)) {
      for (const item of expected) {
        if (typeof item !== 'string') {
          throw ApiError.badRequest(`${field}.${key}[] must contain only strings`);
        }
      }
    }
  }
};

const validateRule = (rule: any, index: number): void => {
  if (!rule || typeof rule !== 'object') {
    throw ApiError.badRequest(`rules[${index}] must be an object`);
  }
  requireString(rule.id, `rules[${index}].id`);
  requireString(rule.action, `rules[${index}].action`);

  const scope = rule.scope;
  if (!POLICY_SCOPES.includes(scope)) {
    throw ApiError.badRequest(`rules[${index}].scope must be one of: ${POLICY_SCOPES.join(', ')}`);
  }
  const effect = rule.effect;
  if (!POLICY_EFFECTS.includes(effect)) {
    throw ApiError.badRequest(`rules[${index}].effect must be one of: ${POLICY_EFFECTS.join(', ')}`);
  }

  optionalString(rule.module, `rules[${index}].module`);
  optionalString(rule.reasonCode, `rules[${index}].reasonCode`);
  optionalNumber(rule.priority, `rules[${index}].priority`);
  optionalNumber(rule.requireApprovalAbove, `rules[${index}].requireApprovalAbove`);
  optionalBoolean(rule.isHard, `rules[${index}].isHard`);

  if (rule.approvalSubject !== undefined && rule.approvalSubject !== null) {
    const subject = rule.approvalSubject;
    if (typeof subject !== 'object') {
      throw ApiError.badRequest(`rules[${index}].approvalSubject must be an object`);
    }
    optionalString(subject.type, `rules[${index}].approvalSubject.type`);
    optionalString(subject.id, `rules[${index}].approvalSubject.id`);
  }

  if (rule.conditions !== undefined && rule.conditions !== null) {
    if (typeof rule.conditions !== 'object' || Array.isArray(rule.conditions)) {
      throw ApiError.badRequest(`rules[${index}].conditions must be an object`);
    }
    if (rule.conditions.amount !== undefined && rule.conditions.amount !== null) {
      validateAmountCondition(rule.conditions.amount, index);
    }
    if (rule.conditions.match !== undefined && rule.conditions.match !== null) {
      validateMatchCondition(rule.conditions.match, index);
    }
    optionalBoolean(rule.conditions.requireApprovedOverride, `rules[${index}].conditions.requireApprovedOverride`);
  }
};

/**
 * Validate a full PUT body for the engine-owned `PolicyConfig`.
 *
 * Accepts `{ companyId?, rules: PolicyRule[] }`. The controller MUST resolve
 * `companyId` from the authenticated tenant context — this validator does
 * NOT accept a forged companyId in the body.
 */
export const validateUpdatePolicyConfigInput = (body: any): void => {
  if (!body || typeof body !== 'object') {
    throw ApiError.badRequest('Request body is required');
  }
  if (!Array.isArray(body.rules)) {
    throw ApiError.badRequest('rules must be an array');
  }
  for (let i = 0; i < body.rules.length; i += 1) {
    validateRule(body.rules[i], i);
  }
};

/**
 * Helper used by the per-module doorways to constrain the rules they accept
 * to a single module. This is module-local filtering on top of the neutral
 * shape validator. The result is a normalised `PolicyRule[]` (the `module`
 * field is force-stamped so the caller cannot accidentally persist a rule
 * with the wrong module tag).
 */
export const validateAndFilterModuleRules = (
  body: any,
  moduleName: 'pos' | 'sales' | 'purchases' | 'accounting'
): Array<Record<string, any>> => {
  validateUpdatePolicyConfigInput(body);
  const rules = (body.rules || []) as Array<Record<string, any>>;
  return rules.map((rule, idx) => {
    // Reject rules tagged for a DIFFERENT module — a module doorway must
    // never accept (or silently rewrite) a rule for another module.
    if (rule.module !== undefined && rule.module !== moduleName) {
      throw ApiError.badRequest(
        `rules[${idx}].module must be '${moduleName}' (got '${rule.module}')`
      );
    }
    return { ...rule, module: moduleName };
  });
};
