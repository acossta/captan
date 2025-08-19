import { describe, it, expect } from 'vitest';
import { validateCaptable, validateCaptableExtended } from '../schema.js';
import { FileModel } from '../model.js';

describe('Schema Validation Integration Tests', () => {
  describe('Real-world captable scenarios', () => {
    it('should validate a complete startup captable with founders, employees, and investors', () => {
      const startupCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_startup',
          name: 'TechStartup Inc.',
          formationDate: '2023-01-15',
          entityType: 'C_CORP',
          jurisdiction: 'DE',
          currency: 'USD',
        },
        stakeholders: [
          { id: 'sh_founder1', type: 'person', name: 'Alice Founder', email: 'alice@startup.com' },
          { id: 'sh_founder2', type: 'person', name: 'Bob Founder', email: 'bob@startup.com' },
          {
            id: 'sh_employee1',
            type: 'person',
            name: 'Charlie Employee',
            email: 'charlie@startup.com',
          },
          { id: 'sh_investor1', type: 'entity', name: 'Venture Capital Fund I' },
          { id: 'sh_angel1', type: 'person', name: 'David Angel' },
        ],
        securityClasses: [
          {
            id: 'sc_common',
            kind: 'COMMON',
            label: 'Common Stock',
            authorized: 10000000,
            parValue: 0.0001,
          },
          {
            id: 'sc_seriesA',
            kind: 'PREF',
            label: 'Series A Preferred',
            authorized: 3000000,
            parValue: 0.0001,
          },
          {
            id: 'sc_pool',
            kind: 'OPTION_POOL',
            label: '2023 Stock Option Plan',
            authorized: 2000000,
          },
        ],
        issuances: [
          {
            id: 'is_f1',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_founder1',
            qty: 3500000,
            pps: 0.0001,
            date: '2023-01-15',
          },
          {
            id: 'is_f2',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_founder2',
            qty: 3500000,
            pps: 0.0001,
            date: '2023-01-15',
          },
          {
            id: 'is_inv1',
            securityClassId: 'sc_seriesA',
            stakeholderId: 'sh_investor1',
            qty: 2000000,
            pps: 2.5,
            date: '2024-03-01',
          },
        ],
        optionGrants: [
          {
            id: 'og_emp1',
            stakeholderId: 'sh_employee1',
            qty: 100000,
            exercise: 0.5,
            grantDate: '2023-06-01',
            vesting: {
              start: '2023-06-01',
              monthsTotal: 48,
              cliffMonths: 12,
            },
          },
        ],
        safes: [
          {
            id: 'safe_angel1',
            stakeholderId: 'sh_angel1',
            amount: 250000,
            date: '2023-09-01',
            cap: 10000000,
            discount: 0.8,
            type: 'post',
          },
        ],
        valuations: [
          {
            id: 'val_409a2024',
            date: '2024-01-01',
            type: '409a',
            preMoney: 8000000,
            sharePrice: 0.45,
            methodology: 'Market approach',
            provider: 'Valuation Experts LLC',
          },
        ],
        audit: [
          {
            ts: '2023-01-15T10:00:00Z',
            by: 'system',
            action: 'INIT',
            data: { company: 'TechStartup Inc.' },
          },
        ],
      };

      const basicResult = validateCaptable(startupCaptable);
      expect(basicResult.valid).toBe(true);

      const extendedResult = validateCaptableExtended(startupCaptable);
      expect(extendedResult.valid).toBe(true);
      expect(extendedResult.warnings).toBeUndefined(); // No orphaned stakeholders, all have equity
    });

    it('should handle complex SAFE conversion scenario', () => {
      const safeHeavyCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_safeco',
          name: 'SAFE Company',
          formationDate: '2024-01-01',
          entityType: 'C_CORP',
          jurisdiction: 'CA',
          currency: 'USD',
        },
        stakeholders: [
          { id: 'sh_founder', type: 'person', name: 'Founder' },
          { id: 'sh_safe1', type: 'person', name: 'SAFE Investor 1' },
          { id: 'sh_safe2', type: 'entity', name: 'SAFE Fund 2' },
          { id: 'sh_safe3', type: 'person', name: 'SAFE Investor 3' },
        ],
        securityClasses: [
          {
            id: 'sc_common',
            kind: 'COMMON',
            label: 'Common Stock',
            authorized: 10000000,
            parValue: 0.0001,
          },
        ],
        issuances: [
          {
            id: 'is_founder',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_founder',
            qty: 8000000,
            pps: 0.0001,
            date: '2024-01-01',
          },
        ],
        optionGrants: [],
        safes: [
          {
            id: 'safe_1',
            stakeholderId: 'sh_safe1',
            amount: 100000,
            date: '2024-02-01',
            cap: 5000000,
            type: 'post',
          },
          {
            id: 'safe_2',
            stakeholderId: 'sh_safe2',
            amount: 500000,
            date: '2024-03-01',
            discount: 0.75,
          },
          {
            id: 'safe_3',
            stakeholderId: 'sh_safe3',
            amount: 250000,
            date: '2024-04-01',
            cap: 8000000,
            discount: 0.85,
            type: 'pre',
          },
        ],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(safeHeavyCaptable);
      expect(result.valid).toBe(true);
      // SAFE 2 has no cap, which should generate a warning
      expect(
        result.warnings?.find((w) => w.message.includes('neither cap nor discount'))
      ).toBeUndefined();
      // But it has discount, so no warning
    });

    it('should detect over-issuance scenario', () => {
      const overIssuedCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_over',
          name: 'Over-issued Corp',
          formationDate: '2024-01-01',
          entityType: 'C_CORP',
        },
        stakeholders: [
          { id: 'sh_1', type: 'person', name: 'Stakeholder 1' },
          { id: 'sh_2', type: 'person', name: 'Stakeholder 2' },
        ],
        securityClasses: [
          {
            id: 'sc_common',
            kind: 'COMMON',
            label: 'Common Stock',
            authorized: 1000000,
            parValue: 0.0001,
          },
        ],
        issuances: [
          {
            id: 'is_1',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_1',
            qty: 600000,
            pps: 0.0001,
            date: '2024-01-01',
          },
          {
            id: 'is_2',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_2',
            qty: 500000,
            pps: 0.0001,
            date: '2024-01-02',
          },
        ],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(overIssuedCaptable);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('exceed authorized');
      expect(result.errors?.[0]).toContain('1100000'); // Total issued
      expect(result.errors?.[0]).toContain('1000000'); // Authorized
    });

    it('should handle option pool over-grant scenario', () => {
      const overGrantedCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_grants',
          name: 'Grants Corp',
          formationDate: '2024-01-01',
          entityType: 'C_CORP',
        },
        stakeholders: [
          { id: 'sh_emp1', type: 'person', name: 'Employee 1' },
          { id: 'sh_emp2', type: 'person', name: 'Employee 2' },
          { id: 'sh_emp3', type: 'person', name: 'Employee 3' },
        ],
        securityClasses: [
          { id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000 },
          { id: 'sc_pool', kind: 'OPTION_POOL', label: 'Option Pool', authorized: 100000 },
        ],
        issuances: [],
        optionGrants: [
          {
            id: 'og_1',
            stakeholderId: 'sh_emp1',
            qty: 50000,
            exercise: 1.0,
            grantDate: '2024-01-01',
          },
          {
            id: 'og_2',
            stakeholderId: 'sh_emp2',
            qty: 40000,
            exercise: 1.0,
            grantDate: '2024-02-01',
          },
          {
            id: 'og_3',
            stakeholderId: 'sh_emp3',
            qty: 30000,
            exercise: 1.0,
            grantDate: '2024-03-01',
          },
        ],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(overGrantedCaptable);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('option grants');
      expect(result.errors?.[0]).toContain('120000'); // Total granted
      expect(result.errors?.[0]).toContain('100000'); // Pool authorized
    });
  });

  describe('Edge cases and malformed data', () => {
    it('should handle empty arrays gracefully', () => {
      const emptyCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_empty',
          name: 'Empty Corp',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(emptyCaptable);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('should handle very large numbers', () => {
      const largeCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_large',
          name: 'Large Numbers Corp',
        },
        stakeholders: [{ id: 'sh_whale', type: 'entity', name: 'Whale Investor' }],
        securityClasses: [
          {
            id: 'sc_common',
            kind: 'COMMON',
            label: 'Common Stock',
            authorized: Number.MAX_SAFE_INTEGER,
          },
        ],
        issuances: [
          {
            id: 'is_whale',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_whale',
            qty: 1000000000000, // 1 trillion shares
            pps: 0.000001,
            date: '2024-01-01',
          },
        ],
        optionGrants: [],
        safes: [],
        valuations: [
          {
            id: 'val_huge',
            date: '2024-01-01',
            type: 'common',
            preMoney: 1000000000000000, // 1 quadrillion
            sharePrice: 1000,
          },
        ],
        audit: [],
      };

      const result = validateCaptable(largeCaptable);
      expect(result.valid).toBe(true);
    });

    it('should detect circular or missing references', () => {
      const brokenRefsCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_broken',
          name: 'Broken References Corp',
        },
        stakeholders: [{ id: 'sh_exists', type: 'person', name: 'Existing Person' }],
        securityClasses: [
          { id: 'sc_exists', kind: 'COMMON', label: 'Common Stock', authorized: 1000000 },
        ],
        issuances: [
          {
            id: 'is_broken1',
            securityClassId: 'sc_nonexistent', // Doesn't exist
            stakeholderId: 'sh_exists',
            qty: 1000,
            pps: 1,
            date: '2024-01-01',
          },
          {
            id: 'is_broken2',
            securityClassId: 'sc_exists',
            stakeholderId: 'sh_nonexistent', // Doesn't exist
            qty: 1000,
            pps: 1,
            date: '2024-01-01',
          },
        ],
        optionGrants: [
          {
            id: 'og_broken',
            stakeholderId: 'sh_missing', // Doesn't exist
            qty: 1000,
            exercise: 1,
            grantDate: '2024-01-01',
          },
        ],
        safes: [
          {
            id: 'safe_broken',
            stakeholderId: 'sh_ghost', // Doesn't exist
            amount: 100000,
            date: '2024-01-01',
          },
        ],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(brokenRefsCaptable);
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThanOrEqual(4); // At least 4 reference errors
      expect(result.errors?.some((e) => e.includes('sc_nonexistent'))).toBe(true);
      expect(result.errors?.some((e) => e.includes('sh_nonexistent'))).toBe(true);
      expect(result.errors?.some((e) => e.includes('sh_missing'))).toBe(true);
      expect(result.errors?.some((e) => e.includes('sh_ghost'))).toBe(true);
    });
  });

  describe('Performance with large datasets', () => {
    it('should validate large captable efficiently', () => {
      const largeCaptable: FileModel = {
        version: 1,
        company: {
          id: 'comp_perf',
          name: 'Performance Test Corp',
        },
        stakeholders: Array.from({ length: 1000 }, (_, i) => ({
          id: `sh_${i}`,
          type: 'person' as const,
          name: `Stakeholder ${i}`,
        })),
        securityClasses: [
          { id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 100000000 },
        ],
        issuances: Array.from({ length: 1000 }, (_, i) => ({
          id: `is_${i}`,
          securityClassId: 'sc_common',
          stakeholderId: `sh_${i}`,
          qty: 10000,
          pps: 1,
          date: '2024-01-01',
        })),
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const startTime = performance.now();
      const result = validateCaptableExtended(largeCaptable);
      const endTime = performance.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
