/**
 * Common types for all handlers
 */

export interface HandlerResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string; // Optional machine-readable status or error code
}
