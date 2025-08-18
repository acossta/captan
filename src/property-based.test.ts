import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  monthsBetween,
  vestedQty,
  convertSAFE,
  parseUTCDate,
  formatUTCDate,
  isValidISODate,
  Vesting,
  SAFE,
} from './model.js';

describe('Property-Based Testing', () => {
  describe('Date calculations properties', () => {
    it('monthsBetween should be non-negative', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
          fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
          (date1, date2) => {
            const iso1 = formatUTCDate(date1);
            const iso2 = formatUTCDate(date2);
            const result = monthsBetween(iso1, iso2);
            expect(result).toBeGreaterThanOrEqual(0);
          }
        )
      );
    });

    it('monthsBetween should be transitive', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          (date1, date2, date3) => {
            const iso1 = formatUTCDate(date1);
            const iso2 = formatUTCDate(date2);
            const iso3 = formatUTCDate(date3);

            const m12 = monthsBetween(iso1, iso2);
            const m23 = monthsBetween(iso2, iso3);
            const m13 = monthsBetween(iso1, iso3);

            // If date1 >= date2 >= date3, then months(1,3) should be >= months(1,2) + months(2,3)
            if (date1 >= date2 && date2 >= date3) {
              expect(m13).toBeGreaterThanOrEqual(m12 + m23 - 1); // Allow for rounding
              expect(m13).toBeLessThanOrEqual(m12 + m23 + 1);
            }
          }
        )
      );
    });

    it('parseUTCDate and formatUTCDate should be inverse operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1900, max: 2100 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Use 28 to avoid month-end issues
          (year, month, day) => {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const parsed = parseUTCDate(dateStr);
            const formatted = formatUTCDate(parsed);
            expect(formatted).toBe(dateStr);
          }
        )
      );
    });

    it('isValidISODate should correctly validate dates', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Valid dates
            fc
              .tuple(
                fc.integer({ min: 1900, max: 2100 }),
                fc.integer({ min: 1, max: 12 }),
                fc.integer({ min: 1, max: 28 })
              )
              .map(([y, m, d]) => ({
                str: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                valid: true,
              })),
            // Invalid dates
            fc.oneof(
              fc.constant({ str: '2024-13-01', valid: false }), // Invalid month
              fc.constant({ str: 'invalid-date', valid: false }), // Not a date
              fc.constant({ str: '2024/01/01', valid: false }), // Wrong format
              fc.constant({ str: '02-01-2024', valid: false }) // Wrong format
            )
          ),
          ({ str, valid }) => {
            expect(isValidISODate(str)).toBe(valid);
          }
        )
      );
    });
  });

  describe('Vesting properties', () => {
    it('vested quantity should never exceed total quantity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }), // quantity
          fc.integer({ min: 0, max: 600 }), // monthsTotal
          fc.integer({ min: 0, max: 60 }), // cliffMonths
          fc.integer({ min: -100, max: 700 }), // monthsElapsed
          (qty, monthsTotal, cliffMonths, monthsElapsed) => {
            if (monthsTotal === 0 || cliffMonths > monthsTotal) return; // Skip invalid vesting

            const vesting: Vesting = {
              start: '2020-01-01',
              monthsTotal,
              cliffMonths: Math.min(cliffMonths, monthsTotal),
            };

            const checkDate = new Date('2020-01-01');
            checkDate.setMonth(checkDate.getMonth() + monthsElapsed);
            const vested = vestedQty(formatUTCDate(checkDate), qty, vesting);

            expect(vested).toBeGreaterThanOrEqual(0);
            expect(vested).toBeLessThanOrEqual(qty);
          }
        )
      );
    });

    it('vesting should be monotonically increasing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000 }),
          fc.integer({ min: 1, max: 120 }),
          fc.integer({ min: 0, max: 24 }),
          fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 2, maxLength: 10 }),
          (qty, monthsTotal, cliffMonths, monthsArray) => {
            const vesting: Vesting = {
              start: '2020-01-01',
              monthsTotal,
              cliffMonths: Math.min(cliffMonths, monthsTotal),
            };

            // Sort months to ensure increasing order
            const sortedMonths = [...monthsArray].sort((a, b) => a - b);
            let previousVested = 0;

            sortedMonths.forEach((months) => {
              const checkDate = new Date('2020-01-01');
              checkDate.setMonth(checkDate.getMonth() + months);
              const vested = vestedQty(formatUTCDate(checkDate), qty, vesting);

              // Vesting should never decrease
              expect(vested).toBeGreaterThanOrEqual(previousVested);
              previousVested = vested;
            });
          }
        )
      );
    });

    it('vesting should respect cliff period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000 }),
          fc.integer({ min: 12, max: 120 }),
          fc.integer({ min: 3, max: 24 }),
          (qty, monthsTotal, cliffMonths) => {
            const vesting: Vesting = {
              start: '2020-01-01',
              monthsTotal,
              cliffMonths: Math.min(cliffMonths, monthsTotal),
            };

            // Before cliff: should be 0
            const beforeCliff = new Date('2020-01-01T00:00:00.000Z');
            beforeCliff.setUTCMonth(beforeCliff.getUTCMonth() + vesting.cliffMonths - 1);
            const vestedBefore = vestedQty(formatUTCDate(beforeCliff), qty, vesting);
            expect(vestedBefore).toBe(0);

            // At or after cliff: should be > 0 (unless cliff = total)
            if (vesting.cliffMonths < vesting.monthsTotal) {
              const atCliff = new Date('2020-01-01T00:00:00.000Z');
              atCliff.setUTCMonth(atCliff.getUTCMonth() + vesting.cliffMonths);
              const vestedAt = vestedQty(formatUTCDate(atCliff), qty, vesting);
              expect(vestedAt).toBeGreaterThan(0);
            }
          }
        )
      );
    });

    it('full vesting should occur after total months', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000 }),
          fc.integer({ min: 1, max: 120 }),
          fc.integer({ min: 0, max: 60 }),
          (qty, monthsTotal, cliffMonths) => {
            const vesting: Vesting = {
              start: '2020-01-01',
              monthsTotal,
              cliffMonths: Math.min(cliffMonths, monthsTotal),
            };

            // After total months
            const afterTotal = new Date('2020-01-01T00:00:00.000Z');
            afterTotal.setUTCMonth(afterTotal.getUTCMonth() + monthsTotal);
            const vestedAfter = vestedQty(formatUTCDate(afterTotal), qty, vesting);
            expect(vestedAfter).toBe(qty);

            // Well after total months
            const wellAfter = new Date('2020-01-01T00:00:00.000Z');
            wellAfter.setUTCMonth(wellAfter.getUTCMonth() + monthsTotal + 100);
            const vestedWellAfter = vestedQty(formatUTCDate(wellAfter), qty, vesting);
            expect(vestedWellAfter).toBe(qty);
          }
        )
      );
    });
  });

  describe('SAFE conversion properties', () => {
    it('conversion should preserve value within rounding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000000 }), // amount
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }), // pricePerShare
          fc.integer({ min: 100000, max: 10000000 }), // preMoneyShares
          fc.option(fc.integer({ min: 1000000, max: 100000000 })), // cap
          fc.option(fc.float({ min: Math.fround(0.5), max: Math.fround(0.95), noNaN: true })), // discount
          (amount, pricePerShare, preMoneyShares, cap, discount) => {
            const safe: SAFE = {
              id: 'test_safe',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
              cap: cap || undefined,
              discount: discount || undefined,
            };

            const result = convertSAFE(safe, pricePerShare, preMoneyShares);

            // Value should be conserved within price of one share
            const impliedValue = result.sharesIssued * result.conversionPrice;
            const difference = Math.abs(amount - impliedValue);

            // Allow for rounding (one share worth)
            expect(difference).toBeLessThanOrEqual(result.conversionPrice + 0.01);
          }
        )
      );
    });

    it('shares issued should be non-negative integer', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000000 }),
          fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 0, max: 10000000 }),
          (amount, price, shares) => {
            const safe: SAFE = {
              id: 'test',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
            };

            const result = convertSAFE(safe, price, shares);

            expect(result.sharesIssued).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(result.sharesIssued)).toBe(true);
          }
        )
      );
    });

    it('cap should always provide better or equal price vs round price', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10000, max: 1000000 }),
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
          fc.integer({ min: 100000, max: 10000000 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), // cap multiplier
          (amount, pricePerShare, preMoneyShares, capMultiplier) => {
            const capValue = pricePerShare * preMoneyShares * capMultiplier;

            const safeWithCap: SAFE = {
              id: 'cap_safe',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
              cap: capValue,
            };

            const safeWithoutCap: SAFE = {
              id: 'no_cap_safe',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
            };

            const withCap = convertSAFE(safeWithCap, pricePerShare, preMoneyShares);
            const withoutCap = convertSAFE(safeWithoutCap, pricePerShare, preMoneyShares);

            // With cap should get same or better price
            expect(withCap.conversionPrice).toBeLessThanOrEqual(withoutCap.conversionPrice);
            // And therefore same or more shares
            expect(withCap.sharesIssued).toBeGreaterThanOrEqual(withoutCap.sharesIssued);
          }
        )
      );
    });

    it('discount should always provide better price', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10000, max: 1000000 }),
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
          fc.integer({ min: 100000, max: 10000000 }),
          fc.float({ min: 0.5, max: Math.fround(0.95), noNaN: true }),
          (amount, pricePerShare, preMoneyShares, discount) => {
            const safeWithDiscount: SAFE = {
              id: 'discount_safe',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
              discount,
            };

            const safeWithoutDiscount: SAFE = {
              id: 'no_discount_safe',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
            };

            const withDiscount = convertSAFE(safeWithDiscount, pricePerShare, preMoneyShares);
            const withoutDiscount = convertSAFE(safeWithoutDiscount, pricePerShare, preMoneyShares);

            // With discount should get better price
            expect(withDiscount.conversionPrice).toBeLessThanOrEqual(
              withoutDiscount.conversionPrice
            );
            // And therefore more shares
            expect(withDiscount.sharesIssued).toBeGreaterThanOrEqual(withoutDiscount.sharesIssued);
          }
        )
      );
    });

    it('conversion reason should match the best price', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10000, max: 1000000 }),
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
          fc.integer({ min: 100000, max: 10000000 }),
          fc.option(fc.integer({ min: 1000000, max: 100000000 })),
          fc.option(fc.float({ min: Math.fround(0.5), max: Math.fround(0.95), noNaN: true })),
          (amount, pricePerShare, preMoneyShares, cap, discount) => {
            const safe: SAFE = {
              id: 'test',
              stakeholderId: 'sh_1',
              amount,
              date: '2024-01-01',
              cap: cap || undefined,
              discount: discount || undefined,
            };

            const result = convertSAFE(safe, pricePerShare, preMoneyShares);

            // Calculate expected prices
            const roundPrice = pricePerShare;
            const discountPrice = discount ? pricePerShare * discount : Infinity;
            const capPrice = cap && preMoneyShares > 0 ? cap / preMoneyShares : Infinity;

            const minPrice = Math.min(roundPrice, discountPrice, capPrice);

            // Reason should match the minimum price (with tolerance for floating point)
            if (Math.abs(minPrice - capPrice) < 0.0001 && cap) {
              expect(['cap', 'price']).toContain(result.conversionReason);
            } else if (Math.abs(minPrice - discountPrice) < 0.0001 && discount) {
              expect(['discount', 'price']).toContain(result.conversionReason);
            } else {
              expect(result.conversionReason).toBe('price');
            }
          }
        )
      );
    });
  });

  describe('System invariants', () => {
    it('date operations should be deterministic', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          (date1, date2) => {
            const iso1 = formatUTCDate(date1);
            const iso2 = formatUTCDate(date2);

            // Multiple calls should return same result
            const result1 = monthsBetween(iso1, iso2);
            const result2 = monthsBetween(iso1, iso2);
            const result3 = monthsBetween(iso1, iso2);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        )
      );
    });

    it('vesting calculations should be deterministic', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000 }),
          fc.record({
            start: fc.constant('2020-01-01'),
            monthsTotal: fc.integer({ min: 1, max: 120 }),
            cliffMonths: fc.integer({ min: 0, max: 60 }),
          }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (qty, vesting, checkDate) => {
            const iso = formatUTCDate(checkDate);
            const validVesting: Vesting = {
              ...vesting,
              cliffMonths: Math.min(vesting.cliffMonths, vesting.monthsTotal),
            };

            // Multiple calls should return same result
            const result1 = vestedQty(iso, qty, validVesting);
            const result2 = vestedQty(iso, qty, validVesting);
            const result3 = vestedQty(iso, qty, validVesting);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        )
      );
    });
  });
});
