/**
 * Test utility functions for consistent test setup
 */

import { vi, beforeEach, afterEach } from 'vitest';
import * as dateUtils from './date-utils.js';

/**
 * Set up fake timers and mock the current date
 * @param date - The date to freeze time at (defaults to 2024-01-01)
 */
export function setupFakeTimers(date: string = '2024-01-01') {
  beforeEach(() => {
    // Mock the date utility functions
    vi.spyOn(dateUtils, 'getCurrentDate').mockReturnValue(date);
    vi.spyOn(dateUtils, 'getCurrentTimestamp').mockReturnValue(`${date}T00:00:00.000Z`);

    // Also set system time for any direct Date usage
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${date}T00:00:00.000Z`));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
}

/**
 * Standard mock cleanup for consistent test isolation
 */
export function setupMockCleanup() {
  afterEach(() => {
    vi.clearAllMocks();
  });
}

/**
 * Create a deterministic ID generator for tests
 * @param prefix - The prefix for generated IDs
 * @returns A function that generates sequential IDs
 */
export function createIdGenerator(prefix: string) {
  let counter = 0;
  return () => `${prefix}_test_${++counter}`;
}
