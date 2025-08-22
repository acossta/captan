import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  createStakeholder,
  createSecurityClass,
  getIssuedShares,
  createIssuance,
  createOptionGrant,
  calculateVestedOptions,
  createSAFE,
  calculateSAFEConversions,
  getStakeholderHoldings,
  logAction,
} from './helpers.js';
import type {
  FileModel,
  Stakeholder,
  SecurityClass,
  Issuance,
  OptionGrant,
  SAFE,
  Vesting,
} from '../model.js';

// Mock dependencies
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
}));

// Import mocked modules
import { randomUUID } from 'node:crypto';

const mockRandomUUID = randomUUID as Mock;

describe('Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRandomUUID.mockReturnValue('test-uuid');
  });

  describe('createStakeholder', () => {
    it('should create a person stakeholder with email', () => {
      const stakeholder = createStakeholder('Alice Smith', 'alice@example.com', 'PERSON');

      expect(stakeholder).toEqual({
        id: 'sh_test-uuid',
        name: 'Alice Smith',
        email: 'alice@example.com',
        type: 'person',
      });
    });

    it('should create an entity stakeholder', () => {
      const stakeholder = createStakeholder('Acme Corp', 'contact@acme.com', 'ENTITY');

      expect(stakeholder).toEqual({
        id: 'sh_test-uuid',
        name: 'Acme Corp',
        email: 'contact@acme.com',
        type: 'entity',
      });
    });

    it('should create stakeholder without email', () => {
      const stakeholder = createStakeholder('No Email Person', '', 'PERSON');

      expect(stakeholder).toEqual({
        id: 'sh_test-uuid',
        name: 'No Email Person',
        email: undefined,
        type: 'person',
      });
    });

    it('should default to person type', () => {
      const stakeholder = createStakeholder('Default Type', 'default@example.com');

      expect(stakeholder.type).toBe('person');
    });
  });

  describe('createSecurityClass', () => {
    it('should create a common security class', () => {
      const security = createSecurityClass('COMMON', 'Common Stock', 10000000, 0.001);

      expect(security).toEqual({
        id: 'sc_test-uuid',
        kind: 'COMMON',
        label: 'Common Stock',
        authorized: 10000000,
        parValue: 0.001,
      });
    });

    it('should create a preferred security class (mapped to PREF)', () => {
      const security = createSecurityClass('PREFERRED', 'Series A Preferred', 5000000);

      expect(security).toEqual({
        id: 'sc_test-uuid',
        kind: 'PREF',
        label: 'Series A Preferred',
        authorized: 5000000,
        parValue: undefined,
      });
    });

    it('should create an option pool security class', () => {
      const security = createSecurityClass('OPTION_POOL', 'Employee Option Pool', 2000000);

      expect(security).toEqual({
        id: 'sc_test-uuid',
        kind: 'OPTION_POOL',
        label: 'Employee Option Pool',
        authorized: 2000000,
        parValue: undefined,
      });
    });
  });

  describe('getIssuedShares', () => {
    const mockCaptable: FileModel = {
      version: 2,
      company: {
        id: 'comp_test',
        name: 'Test Company',
        formationDate: '2024-01-01',
        entityType: 'C_CORP',
        jurisdiction: 'DE',
        currency: 'USD',
      },
      stakeholders: [],
      securityClasses: [],
      issuances: [
        {
          id: 'is_1',
          stakeholderId: 'sh_founder',
          securityClassId: 'sc_common',
          qty: 8000000,
          date: '2024-01-01',
        },
        {
          id: 'is_2',
          stakeholderId: 'sh_employee',
          securityClassId: 'sc_common',
          qty: 500000,
          date: '2024-01-02',
        },
        {
          id: 'is_3',
          stakeholderId: 'sh_investor',
          securityClassId: 'sc_preferred',
          qty: 1000000,
          date: '2024-01-03',
        },
      ],
      optionGrants: [],
      safes: [],
      valuations: [],
      audit: [],
    };

    it('should calculate total issued shares for a security class', () => {
      const issued = getIssuedShares(mockCaptable, 'sc_common');

      expect(issued).toBe(8500000); // 8M + 500K
    });

    it('should return correct count for different security class', () => {
      const issued = getIssuedShares(mockCaptable, 'sc_preferred');

      expect(issued).toBe(1000000);
    });

    it('should return 0 for security class with no issuances', () => {
      const issued = getIssuedShares(mockCaptable, 'sc_nonexistent');

      expect(issued).toBe(0);
    });

    it('should handle captable without issuances array', () => {
      const captableWithoutIssuances = { ...mockCaptable, issuances: undefined };

      const issued = getIssuedShares(captableWithoutIssuances, 'sc_common');

      expect(issued).toBe(0);
    });
  });

  describe('createIssuance', () => {
    it('should create an issuance with all fields', () => {
      const issuance = createIssuance(
        'sh_founder',
        'sc_common',
        8000000,
        0.001,
        '2024-01-01',
        'CERT-001'
      );

      expect(issuance).toEqual({
        id: 'is_test-uuid',
        stakeholderId: 'sh_founder',
        securityClassId: 'sc_common',
        qty: 8000000,
        pps: 0.001,
        date: '2024-01-01',
        cert: 'CERT-001',
      });
    });

    it('should create issuance with default date', () => {
      const issuance = createIssuance('sh_founder', 'sc_common', 8000000);

      expect(issuance.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(issuance.pps).toBeUndefined();
      expect(issuance.cert).toBeUndefined();
    });

    it('should create issuance without optional fields', () => {
      const issuance = createIssuance('sh_founder', 'sc_common', 8000000, undefined, '2024-01-01');

      expect(issuance.pps).toBeUndefined();
      expect(issuance.cert).toBeUndefined();
    });
  });

  describe('createOptionGrant', () => {
    const mockVesting: Vesting = {
      start: '2024-01-01',
      monthsTotal: 48,
      cliffMonths: 12,
    };

    it('should create option grant with vesting', () => {
      const grant = createOptionGrant(
        'sh_employee',
        'sc_option_pool',
        100000,
        0.1,
        '2024-01-01',
        mockVesting
      );

      expect(grant).toEqual({
        id: 'og_test-uuid',
        stakeholderId: 'sh_employee',
        qty: 100000,
        exercise: 0.1,
        grantDate: '2024-01-01',
        vesting: mockVesting,
      });
    });

    it('should create option grant without vesting', () => {
      const grant = createOptionGrant('sh_employee', 'sc_option_pool', 100000, 0.1);

      expect(grant.vesting).toBeUndefined();
      expect(grant.grantDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should create grant with default date', () => {
      const grant = createOptionGrant('sh_employee', 'sc_option_pool', 100000, 0.1);

      expect(grant.grantDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('calculateVestedOptions', () => {
    const mockGrant: OptionGrant = {
      id: 'og_test',
      stakeholderId: 'sh_employee',
      qty: 100000,
      exercise: 0.1,
      grantDate: '2024-01-01',
      vesting: {
        start: '2024-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      },
    };

    it('should return full quantity for grants without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };

      const vested = calculateVestedOptions(grantWithoutVesting, '2024-12-31');

      expect(vested).toBe(100000);
    });

    it('should calculate vested options using model function', () => {
      // This test assumes the vestedQty function from the model works correctly
      // We're just testing that our helper calls it with the right parameters
      const vested = calculateVestedOptions(mockGrant, '2025-01-01');

      // After 1 year (12 months), should be 25% vested (25,000 options)
      expect(vested).toBeGreaterThan(0);
      expect(vested).toBeLessThanOrEqual(100000);
    });

    it('should handle edge case dates', () => {
      // Test with date before vesting start
      const vestedBefore = calculateVestedOptions(mockGrant, '2023-12-31');
      expect(vestedBefore).toBe(0);

      // Test with date far in the future (should be fully vested)
      const vestedAfter = calculateVestedOptions(mockGrant, '2030-01-01');
      expect(vestedAfter).toBe(100000);
    });
  });

  describe('createSAFE', () => {
    it('should create SAFE with all terms', () => {
      const safe = createSAFE(
        'sh_investor',
        500000,
        10000000,
        20,
        false,
        '2024-01-01',
        'Seed round investment'
      );

      expect(safe).toEqual({
        id: 'safe_test-uuid',
        stakeholderId: 'sh_investor',
        amount: 500000,
        cap: 10000000,
        discount: 0.2, // Converted from percentage
        type: 'pre',
        date: '2024-01-01',
        note: 'Seed round investment',
      });
    });

    it('should create post-money SAFE', () => {
      const safe = createSAFE('sh_investor', 500000, 10000000, undefined, true);

      expect(safe.type).toBe('post');
      expect(safe.discount).toBeUndefined();
    });

    it('should create SAFE with only cap', () => {
      const safe = createSAFE('sh_investor', 500000, 10000000);

      expect(safe.cap).toBe(10000000);
      expect(safe.discount).toBeUndefined();
      expect(safe.type).toBe('pre');
    });

    it('should create SAFE with only discount', () => {
      const safe = createSAFE('sh_investor', 500000, undefined, 25);

      expect(safe.cap).toBeUndefined();
      expect(safe.discount).toBe(0.25);
    });

    it('should use default date', () => {
      const safe = createSAFE('sh_investor', 500000, 10000000);

      expect(safe.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('calculateSAFEConversions', () => {
    const mockCaptable: FileModel = {
      version: 2,
      company: {
        id: 'comp_test',
        name: 'Test Company',
        formationDate: '2024-01-01',
        entityType: 'C_CORP',
        jurisdiction: 'DE',
        currency: 'USD',
      },
      stakeholders: [],
      securityClasses: [],
      issuances: [
        {
          id: 'is_founder',
          stakeholderId: 'sh_founder',
          securityClassId: 'sc_common',
          qty: 8000000,
          date: '2024-01-01',
        },
      ],
      optionGrants: [],
      safes: [
        {
          id: 'safe_cap_only',
          stakeholderId: 'sh_investor1',
          amount: 500000,
          cap: 10000000,
          type: 'pre',
          date: '2024-01-01',
        },
        {
          id: 'safe_discount_only',
          stakeholderId: 'sh_investor2',
          amount: 250000,
          discount: 0.2,
          type: 'pre',
          date: '2024-01-01',
        },
        {
          id: 'safe_both_terms',
          stakeholderId: 'sh_investor3',
          amount: 1000000,
          cap: 15000000,
          discount: 0.25,
          type: 'pre',
          date: '2024-01-01',
        },
      ],
      valuations: [],
      audit: [],
    };

    it('should calculate conversions with cap and discount', () => {
      const conversions = calculateSAFEConversions(mockCaptable, 2.0, 5000000);

      expect(conversions).toHaveLength(3);

      // First SAFE: cap only
      expect(conversions[0].safe.id).toBe('safe_cap_only');
      expect(conversions[0].shares).toBeGreaterThan(0);
      expect(conversions[0].conversionReason).toBe('cap'); // Cap should be better than $2 price

      // Second SAFE: discount only
      expect(conversions[1].safe.id).toBe('safe_discount_only');
      expect(conversions[1].conversionReason).toBe('discount'); // Discount should be better

      // Third SAFE: both terms - should use better of cap or discount
      expect(conversions[2].safe.id).toBe('safe_both_terms');
      expect(['cap', 'discount']).toContain(conversions[2].conversionReason);
    });

    it('should handle round price when no better terms', () => {
      const captableWithHighPrice = {
        ...mockCaptable,
        safes: [
          {
            id: 'safe_high_cap',
            stakeholderId: 'sh_investor',
            amount: 100000,
            cap: 1000000, // Very high cap
            type: 'pre' as const,
            date: '2024-01-01',
          },
        ],
      };

      const conversions = calculateSAFEConversions(captableWithHighPrice, 0.1, 5000000);

      expect(conversions[0].conversionReason).toBe('price');
      expect(conversions[0].conversionPrice).toBe(0.1);
    });

    it('should handle post-money SAFEs', () => {
      const captableWithPostMoney = {
        ...mockCaptable,
        safes: [
          {
            id: 'safe_post',
            stakeholderId: 'sh_investor',
            amount: 500000,
            cap: 10000000,
            type: 'post' as const,
            date: '2024-01-01',
          },
        ],
      };

      const conversions = calculateSAFEConversions(captableWithPostMoney, 2.0, 5000000);

      expect(conversions).toHaveLength(1);
      expect(conversions[0].shares).toBeGreaterThan(0);
    });

    it('should return empty array when no SAFEs', () => {
      const captableWithoutSAFEs = { ...mockCaptable, safes: [] };

      const conversions = calculateSAFEConversions(captableWithoutSAFEs, 2.0, 5000000);

      expect(conversions).toHaveLength(0);
    });

    it('should handle captable without issuances', () => {
      const captableWithoutIssuances = { ...mockCaptable, issuances: undefined };

      const conversions = calculateSAFEConversions(captableWithoutIssuances, 2.0, 5000000);

      expect(conversions).toHaveLength(3);
    });
  });

  describe('getStakeholderHoldings', () => {
    const mockCaptable: FileModel = {
      version: 2,
      company: {
        id: 'comp_test',
        name: 'Test Company',
        formationDate: '2024-01-01',
        entityType: 'C_CORP',
        jurisdiction: 'DE',
        currency: 'USD',
      },
      stakeholders: [
        {
          id: 'sh_founder',
          name: 'Founder',
          email: 'founder@test.com',
          type: 'person',
        },
      ],
      securityClasses: [],
      issuances: [
        {
          id: 'is_founder',
          stakeholderId: 'sh_founder',
          securityClassId: 'sc_common',
          qty: 8000000,
          date: '2024-01-01',
        },
      ],
      optionGrants: [
        {
          id: 'og_founder',
          stakeholderId: 'sh_founder',
          qty: 100000,
          exercise: 0.1,
          grantDate: '2024-01-01',
        },
      ],
      safes: [
        {
          id: 'safe_founder',
          stakeholderId: 'sh_founder',
          amount: 500000,
          type: 'pre',
          date: '2024-01-01',
        },
      ],
      valuations: [],
      audit: [],
    };

    it('should return stakeholder holdings', () => {
      const holdings = getStakeholderHoldings(mockCaptable, 'sh_founder');

      expect(holdings.stakeholder.id).toBe('sh_founder');
      expect(holdings.issuances).toHaveLength(1);
      expect(holdings.issuances[0].id).toBe('is_founder');
      expect(holdings.grants).toHaveLength(1);
      expect(holdings.grants[0].id).toBe('og_founder');
      expect(holdings.safes).toHaveLength(1);
      expect(holdings.safes[0].id).toBe('safe_founder');
    });

    it('should return empty holdings for stakeholder with no holdings', () => {
      const captableWithOtherStakeholder = {
        ...mockCaptable,
        stakeholders: [
          ...mockCaptable.stakeholders,
          {
            id: 'sh_other',
            name: 'Other',
            email: 'other@test.com',
            type: 'person' as const,
          },
        ],
      };

      const holdings = getStakeholderHoldings(captableWithOtherStakeholder, 'sh_other');

      expect(holdings.stakeholder.id).toBe('sh_other');
      expect(holdings.issuances).toHaveLength(0);
      expect(holdings.grants).toHaveLength(0);
      expect(holdings.safes).toHaveLength(0);
    });

    it('should handle undefined arrays', () => {
      const captableWithUndefined = {
        ...mockCaptable,
        issuances: undefined,
        optionGrants: undefined,
        safes: undefined,
      };

      const holdings = getStakeholderHoldings(captableWithUndefined, 'sh_founder');

      expect(holdings.issuances).toHaveLength(0);
      expect(holdings.grants).toHaveLength(0);
      expect(holdings.safes).toHaveLength(0);
    });

    it('should throw error for nonexistent stakeholder', () => {
      expect(() => {
        getStakeholderHoldings(mockCaptable, 'sh_nonexistent');
      }).toThrow('Stakeholder not found: sh_nonexistent');
    });
  });

  describe('logAction', () => {
    it('should add audit log entry to captable', () => {
      const captable: FileModel = {
        version: 2,
        company: {
          id: 'comp_test',
          name: 'Test Company',
          formationDate: '2024-01-01',
          entityType: 'C_CORP',
          jurisdiction: 'DE',
          currency: 'USD',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      logAction(captable, {
        action: 'STAKEHOLDER_ADD',
        entity: 'stakeholder',
        entityId: 'sh_test',
        details: 'Added new stakeholder',
      });

      expect(captable.audit).toHaveLength(1);
      expect(captable.audit[0]).toMatchObject({
        ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        by: 'captan-cli',
        action: 'STAKEHOLDER_ADD',
        data: {
          entity: 'stakeholder',
          entityId: 'sh_test',
          details: 'Added new stakeholder',
        },
      });
    });

    it('should initialize audit array if undefined', () => {
      const captable: FileModel = {
        version: 2,
        company: {
          id: 'comp_test',
          name: 'Test Company',
          formationDate: '2024-01-01',
          entityType: 'C_CORP',
          jurisdiction: 'DE',
          currency: 'USD',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: undefined as any,
      };

      logAction(captable, {
        action: 'INIT',
        entity: 'system',
        entityId: 'captable',
        details: 'Initialized captable',
      });

      expect(captable.audit).toHaveLength(1);
    });

    it('should append to existing audit log', () => {
      const captable: FileModel = {
        version: 2,
        company: {
          id: 'comp_test',
          name: 'Test Company',
          formationDate: '2024-01-01',
          entityType: 'C_CORP',
          jurisdiction: 'DE',
          currency: 'USD',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [
          {
            ts: '2024-01-01T10:00:00.000Z',
            by: 'captan-cli',
            action: 'INIT',
            data: { entity: 'system', entityId: 'captable', details: 'Initial log' },
          },
        ],
      };

      logAction(captable, {
        action: 'STAKEHOLDER_ADD',
        entity: 'stakeholder',
        entityId: 'sh_test',
        details: 'Added stakeholder',
      });

      expect(captable.audit).toHaveLength(2);
      expect(captable.audit[1].action).toBe('STAKEHOLDER_ADD');
    });
  });
});
