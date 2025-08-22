/**
 * Date utility functions that can be easily mocked in tests
 */

/**
 * Get the current date as an ISO string (YYYY-MM-DD)
 * This function should be used instead of new Date().toISOString().slice(0, 10)
 * to make testing easier and more predictable
 */
export function getCurrentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get the current timestamp as an ISO string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
