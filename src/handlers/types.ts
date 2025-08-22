/**
 * Common types for all handlers
 */

export interface HandlerResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
}
