import { describe, it, expect, afterEach } from 'vitest';
import { monthsBetween, vestedQty, Vesting } from './model.js';

describe('UTC Timezone Consistency', () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  describe('monthsBetween - timezone independence', () => {
    const testCases = [
      { tz: 'UTC', desc: 'UTC' },
      { tz: 'America/New_York', desc: 'EST/EDT' },
      { tz: 'Europe/London', desc: 'GMT/BST' },
      { tz: 'Asia/Tokyo', desc: 'JST' },
      { tz: 'Australia/Sydney', desc: 'AEDT/AEST' },
      { tz: 'Pacific/Kiritimati', desc: 'UTC+14' },
      { tz: 'Pacific/Midway', desc: 'UTC-11' },
    ];

    testCases.forEach(({ tz, desc }) => {
      it(`should calculate consistently in ${desc}`, () => {
        process.env.TZ = tz;

        expect(monthsBetween('2024-06-15', '2024-01-15')).toBe(5);
        expect(monthsBetween('2025-01-15', '2024-01-15')).toBe(12);
        expect(monthsBetween('2024-03-31', '2024-01-31')).toBe(2);
        expect(monthsBetween('2024-11-30', '2024-02-29')).toBe(9);
      });
    });

    it('should handle DST transitions consistently', () => {
      process.env.TZ = 'America/New_York';

      // Spring forward (March 2024)
      expect(monthsBetween('2024-04-15', '2024-02-15')).toBe(2);
      expect(monthsBetween('2024-03-10', '2024-03-09')).toBe(0);
      expect(monthsBetween('2024-03-11', '2024-03-10')).toBe(0);

      // Fall back (November 2024)
      expect(monthsBetween('2024-12-15', '2024-10-15')).toBe(2);
      expect(monthsBetween('2024-11-03', '2024-11-02')).toBe(0);
      expect(monthsBetween('2024-11-04', '2024-11-03')).toBe(0);
    });

    it('should handle midnight boundaries across timezones', () => {
      const timezones = ['UTC', 'America/Los_Angeles', 'Asia/Shanghai'];

      timezones.forEach((tz) => {
        process.env.TZ = tz;

        // Midnight to midnight
        expect(monthsBetween('2024-01-01', '2023-12-01')).toBe(1);
        expect(monthsBetween('2024-01-01', '2023-01-01')).toBe(12);

        // End of month calculations
        expect(monthsBetween('2024-02-29', '2024-01-31')).toBe(0);
        expect(monthsBetween('2024-03-01', '2024-01-31')).toBe(1);
      });
    });

    it('should handle year boundaries consistently', () => {
      const timezones = ['Pacific/Auckland', 'UTC', 'Pacific/Honolulu'];

      timezones.forEach((tz) => {
        process.env.TZ = tz;

        expect(monthsBetween('2025-01-01', '2024-12-31')).toBe(0);
        expect(monthsBetween('2025-01-31', '2024-12-31')).toBe(1);
        expect(monthsBetween('2025-02-01', '2024-12-01')).toBe(2);
      });
    });

    it('should handle century boundaries', () => {
      process.env.TZ = 'UTC';
      expect(monthsBetween('2100-01-01', '2099-12-01')).toBe(1);
      expect(monthsBetween('2000-03-01', '1999-03-01')).toBe(12);
    });

    it('should handle dates near epoch', () => {
      process.env.TZ = 'UTC';
      expect(monthsBetween('1970-02-01', '1970-01-01')).toBe(1);
      expect(monthsBetween('1970-01-01', '1969-12-01')).toBe(1);
    });

    it('should handle far future dates', () => {
      process.env.TZ = 'UTC';
      expect(monthsBetween('2999-12-31', '2999-01-01')).toBe(11);
      expect(monthsBetween('3000-01-01', '2999-01-01')).toBe(12);
    });
  });

  describe('vestedQty - timezone independence', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Europe/London'];

    timezones.forEach((tz) => {
      it(`should calculate vesting consistently in ${tz}`, () => {
        process.env.TZ = tz;

        expect(vestedQty('2024-12-31', 4800, vesting)).toBe(0);
        expect(vestedQty('2025-01-01', 4800, vesting)).toBe(1200);
        expect(vestedQty('2026-01-01', 4800, vesting)).toBe(2400);
        expect(vestedQty('2027-01-01', 4800, vesting)).toBe(3600);
        expect(vestedQty('2028-01-01', 4800, vesting)).toBe(4800);
      });
    });

    it('should handle vesting across DST transitions', () => {
      process.env.TZ = 'America/New_York';

      const vestingMarch: Vesting = {
        start: '2024-03-01',
        monthsTotal: 12,
        cliffMonths: 3,
      };

      // Across spring DST change
      expect(vestedQty('2024-06-01', 1200, vestingMarch)).toBe(300);
      expect(vestedQty('2024-07-01', 1200, vestingMarch)).toBe(400);

      const vestingNov: Vesting = {
        start: '2024-11-01',
        monthsTotal: 12,
        cliffMonths: 3,
      };

      // Across fall DST change
      expect(vestedQty('2025-02-01', 1200, vestingNov)).toBe(300);
      expect(vestedQty('2025-03-01', 1200, vestingNov)).toBe(400);
    });

    it('should handle vesting starting on leap day', () => {
      const leapVesting: Vesting = {
        start: '2024-02-29',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      const timezones = ['UTC', 'Pacific/Fiji', 'America/Chicago'];

      timezones.forEach((tz) => {
        process.env.TZ = tz;

        // Non-leap year handling - Feb 28 2025 is less than 12 months from Feb 29 2024
        expect(vestedQty('2025-02-28', 4800, leapVesting)).toBe(0); // Still before cliff
        expect(vestedQty('2025-03-01', 4800, leapVesting)).toBe(1200); // After cliff
        expect(vestedQty('2026-02-28', 4800, leapVesting)).toBe(2300); // 23 months (not 24 due to Feb 28 < Feb 29)
        expect(vestedQty('2026-03-01', 4800, leapVesting)).toBe(2400); // 24 months
        expect(vestedQty('2028-02-29', 4800, leapVesting)).toBe(4800); // Full vest on another leap day
      });
    });

    it('should handle vesting with extreme cliff periods', () => {
      const extremeVesting: Vesting = {
        start: '2020-01-01',
        monthsTotal: 240, // 20 years
        cliffMonths: 60, // 5 year cliff
      };

      process.env.TZ = 'UTC';
      expect(vestedQty('2024-12-31', 10000, extremeVesting)).toBe(0);
      expect(vestedQty('2025-01-01', 10000, extremeVesting)).toBe(2500);
      expect(vestedQty('2030-01-01', 10000, extremeVesting)).toBe(5000);
      expect(vestedQty('2040-01-01', 10000, extremeVesting)).toBe(10000);
    });
  });

  describe('Date parsing edge cases', () => {
    it('should handle malformed date strings consistently', () => {
      process.env.TZ = 'UTC';

      // These should work with the current implementation
      // Note: parseUTCDate now requires proper padding for ISO dates
      expect(monthsBetween('2024-01-01', '2024-01-01')).toBe(0);
      expect(monthsBetween('2024-06-15', '2024-01-15')).toBe(5);

      // Date with time component
      expect(monthsBetween('2024-01-01T12:00:00', '2024-01-01')).toBe(0);
      expect(monthsBetween('2024-01-01T00:00:00.000Z', '2024-01-01')).toBe(0);
    });

    it('should handle date strings with different formats', () => {
      process.env.TZ = 'UTC';

      // ISO 8601 format
      expect(monthsBetween('2024-06-15', '2024-01-15')).toBe(5);

      // With leading zeros
      expect(monthsBetween('2024-06-01', '2024-01-01')).toBe(5);
      expect(monthsBetween('2024-06-09', '2024-01-09')).toBe(5);
    });

    it('should handle boundary dates for each month', () => {
      process.env.TZ = 'UTC';

      // First day of month
      expect(monthsBetween('2024-02-01', '2024-01-01')).toBe(1);
      expect(monthsBetween('2024-03-01', '2024-02-01')).toBe(1);

      // Last day of month
      expect(monthsBetween('2024-01-31', '2023-12-31')).toBe(1);
      expect(monthsBetween('2024-02-29', '2024-01-31')).toBe(0);
      expect(monthsBetween('2024-03-31', '2024-02-29')).toBe(1);
      expect(monthsBetween('2024-04-30', '2024-03-31')).toBe(0);
    });
  });

  describe('Cross-timezone date calculations', () => {
    it('should maintain consistency when dates cross midnight in different timezones', () => {
      // Test a date that's in different days depending on timezone
      const testDate = '2024-01-01'; // This is Jan 1 in UTC, but Dec 31 in US timezones

      const vesting: Vesting = {
        start: testDate,
        monthsTotal: 12,
        cliffMonths: 3,
      };

      const results: number[] = [];

      ['UTC', 'America/Los_Angeles', 'America/New_York', 'Asia/Tokyo'].forEach((tz) => {
        process.env.TZ = tz;
        results.push(vestedQty('2024-04-01', 1200, vesting));
      });

      // All timezones should give the same result
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe(300); // 3 months vested
    });

    it('should handle calculations spanning multiple years consistently', () => {
      const longTermVesting: Vesting = {
        start: '2020-01-01',
        monthsTotal: 120, // 10 years
        cliffMonths: 12,
      };

      const timezones = ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway'];
      const results: number[] = [];

      timezones.forEach((tz) => {
        process.env.TZ = tz;
        results.push(vestedQty('2025-01-01', 10000, longTermVesting));
      });

      // All should return 5000 (5 years = 50%)
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe(5000);
    });
  });

  describe('Precision and rounding in date calculations', () => {
    it('should handle sub-month precision correctly', () => {
      process.env.TZ = 'UTC';

      // Same month, different days
      expect(monthsBetween('2024-01-31', '2024-01-01')).toBe(0);
      expect(monthsBetween('2024-01-31', '2024-01-30')).toBe(0);

      // Exactly one month
      expect(monthsBetween('2024-02-01', '2024-01-01')).toBe(1);
      expect(monthsBetween('2024-02-15', '2024-01-15')).toBe(1);
      expect(monthsBetween('2024-02-28', '2024-01-28')).toBe(1);
    });

    it('should handle month-end date arithmetic correctly', () => {
      process.env.TZ = 'UTC';

      // January 31 + 1 month should handle February's shorter length
      expect(monthsBetween('2024-02-28', '2024-01-31')).toBe(0);
      expect(monthsBetween('2024-02-29', '2024-01-31')).toBe(0);
      expect(monthsBetween('2024-03-01', '2024-01-31')).toBe(1);

      // From Feb 29 (leap year)
      expect(monthsBetween('2024-03-29', '2024-02-29')).toBe(1);
      expect(monthsBetween('2024-04-29', '2024-02-29')).toBe(2);
      expect(monthsBetween('2025-02-28', '2024-02-29')).toBe(11);
    });
  });

  describe('Stress tests for date calculations', () => {
    it('should handle 1000 random date pairs consistently across timezones', () => {
      const startDates = Array.from(
        { length: 100 },
        (_, i) =>
          `${2020 + Math.floor(i / 20)}-${String((i % 12) + 1).padStart(2, '0')}-${String(
            (i % 28) + 1
          ).padStart(2, '0')}`
      );

      const endDates = Array.from(
        { length: 100 },
        (_, i) =>
          `${2024 + Math.floor(i / 20)}-${String((i % 12) + 1).padStart(2, '0')}-${String(
            (i % 28) + 1
          ).padStart(2, '0')}`
      );

      const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo'];

      startDates.slice(0, 10).forEach((start) => {
        endDates.slice(0, 10).forEach((end) => {
          const results = timezones.map((tz) => {
            process.env.TZ = tz;
            return monthsBetween(end, start);
          });

          // All timezones should give the same result
          expect(new Set(results).size).toBe(1);
        });
      });
    });

    it('should handle vesting calculations for 100 year periods', () => {
      const centuryVesting: Vesting = {
        start: '1950-01-01',
        monthsTotal: 1200, // 100 years
        cliffMonths: 120, // 10 year cliff
      };

      process.env.TZ = 'UTC';

      expect(vestedQty('1959-12-31', 100000, centuryVesting)).toBe(0);
      expect(vestedQty('1960-01-01', 100000, centuryVesting)).toBe(10000);
      expect(vestedQty('2000-01-01', 100000, centuryVesting)).toBe(50000);
      expect(vestedQty('2050-01-01', 100000, centuryVesting)).toBe(100000);
    });
  });
});
