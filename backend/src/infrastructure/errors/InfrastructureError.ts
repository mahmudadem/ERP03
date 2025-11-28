/**
 * InfrastructureError.ts
 * 
 * Purpose:
 * Wraps underlying database or external service errors into a unified application error.
 * Prevents leaking raw database details (like stack traces or driver-specific codes) to the application layer.
 */
export class InfrastructureError extends Error {
  constructor(
    public message: string,
    public originalError?: any,
    public code: string = 'INFRA_ERROR'
  ) {
    super(message);
    this.name = 'InfrastructureError';
    
    // Maintain stack trace
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, InfrastructureError);
    }
  }
}