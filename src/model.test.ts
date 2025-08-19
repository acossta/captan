import { describe, it, expect } from 'vitest';
import {
  monthsBetween,
  vestedQty,
  calcCap,
  FileModel,
  Vesting,
  convertSAFE,
  SAFE,
} from './model.js';

describe('monthsBetween', () => {
  it('should calculate months between two dates', () => {
    expect(monthsBetween('2024-06-15', '2024-01-15')).toBe(5);
    expect(monthsBetween('2025-01-15', '2024-01-15')).toBe(12);
    expect(monthsBetween('2024-01-15', '2024-01-15')).toBe(0);
  });

  it('should handle partial months correctly', () => {
    expect(monthsBetween('2024-06-14', '2024-01-15')).toBe(4);
    expect(monthsBetween('2024-06-16', '2024-01-15')).toBe(5);
  });

  it('should return 0 for negative periods', () => {
    expect(monthsBetween('2024-01-15', '2024-06-15')).toBe(0);
  });

  it('should handle year boundaries', () => {
    expect(monthsBetween('2025-02-15', '2024-11-15')).toBe(3);
    expect(monthsBetween('2025-01-01', '2024-12-01')).toBe(1);
  });
});

describe('vestedQty', () => {
  it('should return 0 when no vesting provided', () => {
    expect(vestedQty('2024-06-15', 1000, undefined)).toBe(0);
  });

  it('should return 0 before cliff', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    expect(vestedQty('2024-06-01', 1000, vesting)).toBe(0);
    expect(vestedQty('2024-12-01', 1000, vesting)).toBe(0);
  });

  it('should vest proportionally after cliff', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    expect(vestedQty('2025-01-01', 1000, vesting)).toBe(250);
    expect(vestedQty('2026-01-01', 1000, vesting)).toBe(500);
    expect(vestedQty('2027-01-01', 1000, vesting)).toBe(750);
  });

  it('should fully vest after total months', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    expect(vestedQty('2028-01-01', 1000, vesting)).toBe(1000);
    expect(vestedQty('2030-01-01', 1000, vesting)).toBe(1000);
  });

  it('should handle 0-month cliff', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 12,
      cliffMonths: 0,
    };

    expect(vestedQty('2024-02-01', 1200, vesting)).toBe(100);
    // After 6 months: 6/12 * 1200 = 600
    expect(vestedQty('2024-07-01', 1200, vesting)).toBe(600);
  });

  it('should handle future start dates', () => {
    const vesting: Vesting = {
      start: '2025-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    expect(vestedQty('2024-06-01', 1000, vesting)).toBe(0);
  });

  it('should handle cliff exactly at vesting date', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    // Exactly at cliff (12 months)
    expect(vestedQty('2025-01-01', 4800, vesting)).toBe(1200); // 25% vested
    // One day before cliff
    expect(vestedQty('2024-12-31', 4800, vesting)).toBe(0);
    // One day after cliff
    expect(vestedQty('2025-01-02', 4800, vesting)).toBe(1200);
  });

  it('should handle leap year dates correctly', () => {
    const vesting: Vesting = {
      start: '2024-02-29', // Leap year date
      monthsTotal: 12,
      cliffMonths: 3,
    };

    expect(vestedQty('2024-05-29', 1200, vesting)).toBe(300); // 3 months = 25%
    expect(vestedQty('2025-02-28', 1200, vesting)).toBe(1100); // 11 months (Feb 28 is day before anniversary)
    expect(vestedQty('2025-03-01', 1200, vesting)).toBe(1200); // Full vest after 12 months
  });

  it('should handle fractional vesting amounts', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 36,
      cliffMonths: 12,
    };

    // With 1000 shares over 36 months
    // After cliff (12 months) = 12/36 * 1000 = 333.33, rounds down to 333
    expect(vestedQty('2025-01-01', 1000, vesting)).toBe(333);
    // 2025-07-01 is 18 months from 2024-01-01
    // 18/36 * 1000 = 500
    expect(vestedQty('2025-07-01', 1000, vesting)).toBe(500);
    // After 24 months = 24/36 * 1000 = 666.67, rounds down to 666
    expect(vestedQty('2026-01-01', 1000, vesting)).toBe(666);
  });

  it('should handle single-month vesting period', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 1,
      cliffMonths: 0,
    };

    expect(vestedQty('2024-01-15', 1000, vesting)).toBe(0); // Mid-month
    expect(vestedQty('2024-02-01', 1000, vesting)).toBe(1000); // Fully vested after 1 month
  });

  it('should handle cliff equal to total months', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 12,
      cliffMonths: 12,
    };

    expect(vestedQty('2024-12-31', 1000, vesting)).toBe(0); // Before cliff
    expect(vestedQty('2025-01-01', 1000, vesting)).toBe(1000); // All vests at cliff
  });

  it('should handle very long vesting periods', () => {
    const vesting: Vesting = {
      start: '2020-01-01',
      monthsTotal: 120, // 10 years
      cliffMonths: 24,
    };

    expect(vestedQty('2022-01-01', 10000, vesting)).toBe(2000); // 20% after cliff
    expect(vestedQty('2025-01-01', 10000, vesting)).toBe(5000); // 50% after 5 years
    expect(vestedQty('2030-01-01', 10000, vesting)).toBe(10000); // Fully vested
  });

  it('should handle vesting with different month lengths', () => {
    const vesting: Vesting = {
      start: '2024-01-31', // Start on 31st
      monthsTotal: 12,
      cliffMonths: 2,
    };

    // February has 29 days in 2024 (leap year)
    expect(vestedQty('2024-02-29', 1200, vesting)).toBe(0); // Less than 1 month, still before cliff
    expect(vestedQty('2024-03-31', 1200, vesting)).toBe(200); // 2 months = 2/12 * 1200 = 200
    expect(vestedQty('2024-04-30', 1200, vesting)).toBe(200); // Still 2 months (30 < 31)
    expect(vestedQty('2024-05-01', 1200, vesting)).toBe(300); // 3 months = 3/12 * 1200 = 300
  });

  it('should handle negative grant quantities', () => {
    const vesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    // Current implementation doesn't validate negative quantities
    // It returns negative vested amounts (12/48 * -1000 = -250)
    expect(vestedQty('2025-01-01', -1000, vesting)).toBe(-250);
  });

  describe('Enhanced UTC vesting tests', () => {
    it('should handle vesting with millisecond precision dates', () => {
      const vesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      // Even with time components, should work correctly
      expect(vestedQty('2025-01-01T00:00:00.000Z', 4800, vesting)).toBe(1200);
      expect(vestedQty('2025-01-01T23:59:59.999Z', 4800, vesting)).toBe(1200);
    });

    it('should handle vesting across multiple leap years', () => {
      const vesting: Vesting = {
        start: '2020-02-29', // Leap year start
        monthsTotal: 96, // 8 years
        cliffMonths: 12,
      };

      expect(vestedQty('2021-02-28', 9600, vesting)).toBe(0); // Before cliff
      expect(vestedQty('2021-03-01', 9600, vesting)).toBe(1200); // After cliff
      expect(vestedQty('2024-02-29', 9600, vesting)).toBe(4800); // Another leap year
      expect(vestedQty('2028-02-29', 9600, vesting)).toBe(9600); // Full vest on leap day
    });

    it('should handle vesting with extreme date ranges', () => {
      const vesting: Vesting = {
        start: '1970-01-01', // Unix epoch
        monthsTotal: 600, // 50 years
        cliffMonths: 60, // 5 year cliff
      };

      expect(vestedQty('1974-12-31', 50000, vesting)).toBe(0);
      expect(vestedQty('1975-01-01', 50000, vesting)).toBe(5000);
      expect(vestedQty('2020-01-01', 50000, vesting)).toBe(50000);
    });

    it('should handle all month-end combinations correctly', () => {
      // Test vesting starting on each possible month-end day
      const monthEnds = [
        { date: '2024-01-31', desc: '31-day month' },
        { date: '2024-02-29', desc: 'leap year February' },
        { date: '2023-02-28', desc: 'non-leap February' },
        { date: '2024-04-30', desc: '30-day month' },
      ];

      monthEnds.forEach(({ date, desc }) => {
        const vesting: Vesting = {
          start: date,
          monthsTotal: 12,
          cliffMonths: 3,
        };

        const [year, month, day] = date.split('-');
        const nextYear = String(parseInt(year) + 1);

        // Should fully vest after 12 months
        const vestDate = `${nextYear}-${month}-${day}`;
        expect(vestedQty(vestDate, 1200, vesting)).toBe(1200, `Failed for ${desc}`);
      });
    });

    it('should handle vesting with sub-year periods correctly', () => {
      const shortVesting: Vesting = {
        start: '2024-01-15',
        monthsTotal: 6,
        cliffMonths: 2,
      };

      expect(vestedQty('2024-03-14', 600, shortVesting)).toBe(0); // Day before cliff
      expect(vestedQty('2024-03-15', 600, shortVesting)).toBe(200); // At cliff
      expect(vestedQty('2024-07-15', 600, shortVesting)).toBe(600); // Fully vested
    });

    it('should handle vesting with very large quantities', () => {
      const vesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      const largeQty = 1000000000; // 1 billion
      expect(vestedQty('2025-01-01', largeQty, vesting)).toBe(250000000);
      expect(vestedQty('2026-01-01', largeQty, vesting)).toBe(500000000);
      expect(vestedQty('2028-01-01', largeQty, vesting)).toBe(1000000000);
    });

    it('should handle rounding consistently for fractional vesting', () => {
      const vesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 37, // Prime number for interesting fractions
        cliffMonths: 11,
      };

      // Test various quantities that would create fractional shares
      expect(vestedQty('2025-01-01', 999, vesting)).toBe(324); // 12/37 * 999 = 324.324...
      expect(vestedQty('2025-01-01', 1, vesting)).toBe(0); // 12/37 * 1 = 0.324...
      expect(vestedQty('2025-01-01', 3, vesting)).toBe(0); // 12/37 * 3 = 0.972...
      expect(vestedQty('2025-01-01', 4, vesting)).toBe(1); // 12/37 * 4 = 1.297...
    });

    it('should handle accelerated vesting scenarios', () => {
      const vesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      // Normal vesting
      expect(vestedQty('2025-01-01', 4800, vesting)).toBe(1200);

      // Simulate acceleration - immediate full vesting
      const immediateVesting: Vesting = {
        start: '2024-01-01',
        cliffMonths: 0,
        monthsTotal: 1, // Use 1 month for immediate vesting instead of 0
      };
      expect(vestedQty('2024-02-01', 4800, immediateVesting)).toBe(4800); // Fully vested after 1 month
    });

    it('should maintain precision across century boundaries', () => {
      const vesting: Vesting = {
        start: '1999-12-31',
        monthsTotal: 24,
        cliffMonths: 6,
      };

      expect(vestedQty('2000-06-30', 2400, vesting)).toBe(0); // Before cliff (5 months, day 30 < 31)
      expect(vestedQty('2000-07-01', 2400, vesting)).toBe(600); // After cliff (6 months)
      expect(vestedQty('2001-12-31', 2400, vesting)).toBe(2400); // Fully vested
    });

    it('should handle vesting with non-standard month counts', () => {
      // Test with various month counts including primes and edge cases
      const testCases = [
        { months: 1, cliff: 0, desc: 'single month' },
        { months: 13, cliff: 3, desc: 'prime months' },
        { months: 60, cliff: 12, desc: '5 years' },
        { months: 120, cliff: 24, desc: '10 years' },
        { months: 360, cliff: 36, desc: '30 years' },
      ];

      testCases.forEach(({ months, cliff, desc }) => {
        const vesting: Vesting = {
          start: '2024-01-01',
          monthsTotal: months,
          cliffMonths: cliff,
        };

        const qty = months * 100;

        // Test at cliff
        if (cliff > 0) {
          const cliffDate = new Date('2024-01-01T00:00:00.000Z');
          cliffDate.setUTCMonth(cliffDate.getUTCMonth() + cliff);
          const cliffISO = cliffDate.toISOString().slice(0, 10);
          const expectedAtCliff = Math.floor((cliff / months) * qty);
          expect(vestedQty(cliffISO, qty, vesting)).toBe(
            expectedAtCliff,
            `Failed at cliff for ${desc}`
          );
        }

        // Test at full vest
        const fullVestDate = new Date('2024-01-01T00:00:00.000Z');
        fullVestDate.setUTCMonth(fullVestDate.getUTCMonth() + months);
        const fullVestISO = fullVestDate.toISOString().slice(0, 10);
        expect(vestedQty(fullVestISO, qty, vesting)).toBe(qty, `Failed at full vest for ${desc}`);
      });
    });
  });

  describe('Date boundary stress tests', () => {
    it('should handle every day of February correctly', () => {
      // Test both leap and non-leap years
      const years = [2023, 2024]; // non-leap and leap

      years.forEach((year) => {
        const daysInFeb = year === 2024 ? 29 : 28;

        for (let day = 1; day <= daysInFeb; day++) {
          const startDate = `${year}-02-${String(day).padStart(2, '0')}`;
          const vesting: Vesting = {
            start: startDate,
            monthsTotal: 12,
            cliffMonths: 3,
          };

          // Should vest 25% after 3 months
          const vestDate = `${year}-05-${String(Math.min(day, 31)).padStart(2, '0')}`;
          expect(vestedQty(vestDate, 1200, vesting)).toBe(300, `Failed for ${startDate}`);
        }
      });
    });

    it('should handle vesting across all month boundaries', () => {
      // Test vesting that crosses each month boundary
      for (let month = 1; month <= 12; month++) {
        const startDate = `2024-${String(month).padStart(2, '0')}-15`;
        const vesting: Vesting = {
          start: startDate,
          monthsTotal: 3,
          cliffMonths: 1,
        };

        const nextMonth = month === 12 ? 1 : month + 1;
        const year = month === 12 ? 2025 : 2024;
        const vestDate = `${year}-${String(nextMonth).padStart(2, '0')}-15`;

        expect(vestedQty(vestDate, 300, vesting)).toBe(100, `Failed for month ${month}`);
      }
    });

    it('should handle December 31 to January 1 transitions', () => {
      const vesting: Vesting = {
        start: '2023-12-31',
        monthsTotal: 12,
        cliffMonths: 0,
      };

      expect(vestedQty('2023-12-31', 1200, vesting)).toBe(0); // Same day
      expect(vestedQty('2024-01-01', 1200, vesting)).toBe(0); // 1 day, not 1 month
      expect(vestedQty('2024-01-31', 1200, vesting)).toBe(100); // 1 month
      expect(vestedQty('2024-12-31', 1200, vesting)).toBe(1200); // 12 months
    });
  });

  describe('Complex vesting patterns', () => {
    it('should handle back-vesting (vesting before grant date)', () => {
      const backVesting: Vesting = {
        start: '2023-01-01', // Vesting started a year before grant
        monthsTotal: 48,
        cliffMonths: 12,
      };

      // If granted on 2024-01-01 but vesting started 2023-01-01
      // 12 months have already passed
      expect(vestedQty('2024-01-01', 4800, backVesting)).toBe(1200);
      expect(vestedQty('2025-01-01', 4800, backVesting)).toBe(2400);
    });

    it('should handle refresh grants with overlapping vesting', () => {
      // First grant
      const grant1Vesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      // Refresh grant 2 years later
      const grant2Vesting: Vesting = {
        start: '2026-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      // Check both grants at the same date
      const checkDate = '2027-01-01';

      // Grant 1: 36 months elapsed = 75% vested
      expect(vestedQty(checkDate, 4000, grant1Vesting)).toBe(3000);

      // Grant 2: 12 months elapsed = 25% vested
      expect(vestedQty(checkDate, 2000, grant2Vesting)).toBe(500);
    });

    it('should handle daily vesting accurately', () => {
      // Simulate daily vesting by using 48 months (standard 4-year vesting)
      const dailyVesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 48, // 4 years
        cliffMonths: 12, // 1 year cliff
      };

      // After exactly 1 year (25% vested)
      expect(vestedQty('2025-01-01', 1000, dailyVesting)).toBe(250);

      // After 2 years (50% vested)
      expect(vestedQty('2026-01-01', 1000, dailyVesting)).toBe(500);

      // After 4 years (fully vested)
      expect(vestedQty('2028-01-01', 1000, dailyVesting)).toBe(1000);
    });
  });
});

describe('calcCap', () => {
  const createTestModel = (): FileModel => ({
    version: 1,
    company: { id: 'comp_1', name: 'Test Co' },
    stakeholders: [
      { id: 'sh_alice', type: 'person', name: 'Alice', email: 'alice@test.com' },
      { id: 'sh_bob', type: 'person', name: 'Bob', email: 'bob@test.com' },
    ],
    securityClasses: [
      { id: 'sc_common', kind: 'COMMON', label: 'Common', authorized: 10000000 },
      { id: 'sc_pool', kind: 'OPTION_POOL', label: 'Option Pool', authorized: 2000000 },
    ],
    issuances: [
      {
        id: 'is_1',
        securityClassId: 'sc_common',
        stakeholderId: 'sh_alice',
        qty: 7000000,
        pps: 0.0001,
        date: '2024-01-01',
      },
    ],
    optionGrants: [
      {
        id: 'og_1',
        stakeholderId: 'sh_bob',
        qty: 500000,
        exercise: 0.1,
        grantDate: '2024-01-01',
        vesting: { start: '2024-01-01', monthsTotal: 48, cliffMonths: 12 },
      },
    ],
    safes: [],
    valuations: [],
    audit: [],
  });

  it('should calculate basic cap table', () => {
    const model = createTestModel();
    const result = calcCap(model, '2025-01-01');

    expect(result.totals.issuedTotal).toBe(7000000);
    expect(result.totals.vestedOptions).toBe(125000);
    expect(result.totals.outstandingTotal).toBe(7125000);
    expect(result.totals.fd.totalFD).toBe(9000000);
  });

  it('should calculate ownership percentages', () => {
    const model = createTestModel();
    const result = calcCap(model, '2025-01-01');

    const alice = result.rows.find((r) => r.name === 'Alice');
    const bob = result.rows.find((r) => r.name === 'Bob');

    expect(alice).toBeDefined();
    expect(alice?.pctOutstanding).toBeCloseTo(0.9825, 4);
    expect(alice?.pctFullyDiluted).toBeCloseTo(0.7778, 4);

    expect(bob).toBeDefined();
    expect(bob?.pctOutstanding).toBeCloseTo(0.0175, 4);
    expect(bob?.pctFullyDiluted).toBeCloseTo(0.0556, 4);
  });

  it('should handle no vesting', () => {
    const model = createTestModel();
    const result = calcCap(model, '2024-01-01');

    expect(result.totals.vestedOptions).toBe(0);
    expect(result.totals.outstandingTotal).toBe(7000000);
  });

  it('should handle fully vested options', () => {
    const model = createTestModel();
    const result = calcCap(model, '2028-01-01');

    expect(result.totals.vestedOptions).toBe(500000);
    expect(result.totals.unvestedOptions).toBe(0);
  });

  it('should calculate pool remaining', () => {
    const model = createTestModel();
    const result = calcCap(model, '2025-01-01');

    expect(result.totals.fd.poolRemaining).toBe(1500000);
    expect(result.totals.fd.grants).toBe(500000);
  });

  it('should handle empty cap table', () => {
    const model: FileModel = {
      version: 1,
      company: { id: 'comp_1', name: 'Empty Co' },
      stakeholders: [],
      securityClasses: [],
      issuances: [],
      optionGrants: [],
      safes: [],
      valuations: [],
      audit: [],
    };

    const result = calcCap(model, '2025-01-01');

    expect(result.totals.issuedTotal).toBe(0);
    expect(result.totals.outstandingTotal).toBe(0);
    expect(result.totals.fd.totalFD).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it('should sort rows by fully diluted ownership', () => {
    const model = createTestModel();
    model.stakeholders.push({ id: 'sh_charlie', type: 'person', name: 'Charlie' });
    model.issuances.push({
      id: 'is_2',
      securityClassId: 'sc_common',
      stakeholderId: 'sh_charlie',
      qty: 1000000,
      pps: 0.0001,
      date: '2024-01-01',
    });

    const result = calcCap(model, '2025-01-01');

    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[1].name).toBe('Charlie');
    expect(result.rows[2].name).toBe('Bob');
  });
});

describe('convertSAFE', () => {
  const baseSAFE: SAFE = {
    id: 'safe_123',
    stakeholderId: 'sh_alice',
    amount: 100000,
    date: '2024-01-01',
  };

  it('should convert at round price when no cap or discount', () => {
    const result = convertSAFE(baseSAFE, 2.0, 5000000);

    expect(result.sharesIssued).toBe(50000); // 100k / 2.0
    expect(result.conversionPrice).toBe(2.0);
    expect(result.conversionReason).toBe('price');
  });

  it('should apply discount when present', () => {
    const safe: SAFE = { ...baseSAFE, discount: 0.8 }; // 20% discount
    const result = convertSAFE(safe, 2.0, 5000000);

    expect(result.conversionPrice).toBe(1.6); // 2.0 * 0.8
    expect(result.sharesIssued).toBe(62500); // 100k / 1.6
    expect(result.conversionReason).toBe('discount');
  });

  it('should apply cap when better than price', () => {
    const safe: SAFE = { ...baseSAFE, cap: 4000000 };
    const result = convertSAFE(safe, 2.0, 5000000);

    expect(result.conversionPrice).toBe(0.8); // 4M / 5M shares
    expect(result.sharesIssued).toBe(125000); // 100k / 0.8
    expect(result.conversionReason).toBe('cap');
  });

  it('should use the lowest price between cap and discount', () => {
    const safe: SAFE = {
      ...baseSAFE,
      cap: 4000000, // Cap price: 4M/5M = 0.8
      discount: 0.5, // Discount price: 2.0 * 0.5 = 1.0
    };
    const result = convertSAFE(safe, 2.0, 5000000);

    expect(result.conversionPrice).toBe(0.8); // Cap is better
    expect(result.sharesIssued).toBe(125000);
    expect(result.conversionReason).toBe('cap');
  });

  it('should prefer discount when better than cap', () => {
    const safe: SAFE = {
      ...baseSAFE,
      cap: 8000000, // Cap price: 8M/5M = 1.6
      discount: 0.6, // Discount price: 2.0 * 0.6 = 1.2
    };
    const result = convertSAFE(safe, 2.0, 5000000);

    expect(result.conversionPrice).toBe(1.2); // Discount is better
    expect(result.sharesIssued).toBe(83333); // 100k / 1.2
    expect(result.conversionReason).toBe('discount');
  });

  it('should handle post-money SAFE', () => {
    const safe: SAFE = {
      ...baseSAFE,
      cap: 5050000,
      type: 'post',
    };

    // Post-money: cap / (existing shares + new shares from SAFE)
    // Approximation: 5.05M / (5M + 50k) ≈ 1.0
    const result = convertSAFE(safe, 2.0, 5000000, true);

    expect(result.conversionPrice).toBeLessThan(2.0);
    expect(result.conversionReason).toBe('cap');
  });

  it('should handle large investment amounts', () => {
    const safe: SAFE = {
      ...baseSAFE,
      amount: 1000000,
      cap: 10000000,
    };
    const result = convertSAFE(safe, 3.0, 5000000);

    expect(result.conversionPrice).toBe(2.0); // 10M / 5M
    expect(result.sharesIssued).toBe(500000); // 1M / 2.0
    expect(result.conversionReason).toBe('cap');
  });

  it('should handle post-money SAFE with zero existing shares edge case', () => {
    const safe: SAFE = {
      ...baseSAFE,
      cap: 1000000,
      type: 'post',
    };
    // Edge case: when existingShares is 0, falls back to round price
    const result = convertSAFE(safe, 2.0, 0, true);
    expect(result.conversionPrice).toBe(2.0); // Falls back to round price
    expect(result.sharesIssued).toBe(50000); // 100000 / 2.0
    expect(result.conversionReason).toBe('price');
  });

  it('should handle post-money SAFE with zero cap edge case', () => {
    const safe: SAFE = {
      ...baseSAFE,
      cap: 0,
      type: 'post',
    };
    // Edge case: when safeCap is 0, should use round price
    const result = convertSAFE(safe, 2.0, 5000000, true);
    expect(result.conversionPrice).toBe(2.0);
    expect(result.sharesIssued).toBe(50000);
    expect(result.conversionReason).toBe('price');
  });

  it('should handle post-money SAFE requiring max iterations', () => {
    const safe: SAFE = {
      ...baseSAFE,
      amount: 10000000, // Very large amount
      cap: 100000000,
      type: 'post',
    };
    // This should trigger the max iterations path
    const result = convertSAFE(safe, 100.0, 1000000, true);
    expect(result.sharesIssued).toBeGreaterThan(0);
    expect(result.conversionPrice).toBeGreaterThan(0);
    expect(result.conversionReason).toBe('cap');
  });

  it('should handle SAFE with zero investment amount edge case', () => {
    const safe: SAFE = {
      ...baseSAFE,
      amount: 0,
      cap: 1000000,
    };
    const result = convertSAFE(safe, 2.0, 5000000);
    expect(result.sharesIssued).toBe(0);
    expect(result.conversionPrice).toBe(2.0);
    expect(result.conversionReason).toBe('price');
  });

  it('should handle SAFE with zero price and no cap edge case', () => {
    const safe: SAFE = {
      ...baseSAFE,
    };
    const result = convertSAFE(safe, 0, 5000000);
    expect(result.sharesIssued).toBe(0);
    expect(result.conversionPrice).toBe(0);
    expect(result.conversionReason).toBe('price');
  });
});
