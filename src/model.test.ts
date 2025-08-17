import { describe, it, expect } from 'vitest';
import { monthsBetween, vestedQty, calcCap, FileModel, Vesting } from './model.js';

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
    expect(vestedQty('2024-07-01', 1200, vesting)).toBe(500);
  });

  it('should handle future start dates', () => {
    const vesting: Vesting = {
      start: '2025-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    expect(vestedQty('2024-06-01', 1000, vesting)).toBe(0);
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
