import { describe, it, expect } from 'vitest';
import {
  parseFounderString,
  calculatePoolFromPercentage,
  buildModelFromWizard,
} from './init-wizard.js';
import { EntityType } from './model.js';

describe('init-wizard', () => {
  describe('parseFounderString', () => {
    it('parses simple format "Name:shares"', () => {
      const result = parseFounderString('Alice Founder:5000000');
      expect(result.name).toBe('Alice Founder');
      expect(result.shares).toBe(5000000);
      expect(result.email).toBeUndefined();
    });

    it('parses format with email "Name:email:shares"', () => {
      const result = parseFounderString('Bob Smith:bob@example.com:3000000');
      expect(result.name).toBe('Bob Smith');
      expect(result.email).toBe('bob@example.com');
      expect(result.shares).toBe(3000000);
    });

    it('ignores price per share in "Name:shares@pps"', () => {
      const result = parseFounderString('Charlie:2000000@0.0001');
      expect(result.name).toBe('Charlie');
      expect(result.shares).toBe(2000000);
    });

    it('handles comma-formatted numbers', () => {
      const result = parseFounderString('Dave:1,000,000');
      expect(result.shares).toBe(1000000);
    });

    it('throws on invalid format', () => {
      expect(() => parseFounderString('Invalid')).toThrow('Invalid founder format');
    });

    it('handles email with @ symbol', () => {
      const result = parseFounderString('Eve:eve@company.com:4000000');
      expect(result.name).toBe('Eve');
      expect(result.email).toBe('eve@company.com');
      expect(result.shares).toBe(4000000);
    });

    it('handles spaces in names', () => {
      const result = parseFounderString('John Doe Smith:1500000');
      expect(result.name).toBe('John Doe Smith');
      expect(result.shares).toBe(1500000);
    });

    it('handles zero shares', () => {
      const result = parseFounderString('Zero Guy:0');
      expect(result.name).toBe('Zero Guy');
      expect(result.shares).toBe(0);
    });

    it('handles non-numeric shares as zero', () => {
      const result = parseFounderString('Bad:0');
      expect(result.name).toBe('Bad');
      expect(result.shares).toBe(0);
    });

    it('handles price in email format', () => {
      const result = parseFounderString('Price Test:test@example.com:1000000@0.001');
      expect(result.name).toBe('Price Test');
      expect(result.email).toBe('test@example.com');
      expect(result.shares).toBe(1000000);
    });
  });

  describe('calculatePoolFromPercentage', () => {
    it('calculates 20% pool correctly', () => {
      // If founders have 8M and pool is 20% of total:
      // Pool = 8M * 0.2 / 0.8 = 2M
      const pool = calculatePoolFromPercentage(8000000, 20);
      expect(pool).toBe(2000000);
    });

    it('calculates 10% pool correctly', () => {
      // If founders have 9M and pool is 10% of total:
      // Pool = 9M * 0.1 / 0.9 = 1M
      const pool = calculatePoolFromPercentage(9000000, 10);
      expect(pool).toBe(1000000);
    });

    it('calculates 25% pool correctly', () => {
      // If founders have 7.5M and pool is 25% of total:
      // Pool = 7.5M * 0.25 / 0.75 = 2.5M
      const pool = calculatePoolFromPercentage(7500000, 25);
      expect(pool).toBe(2500000);
    });

    it('handles 0% pool', () => {
      const pool = calculatePoolFromPercentage(10000000, 0);
      expect(pool).toBe(0);
    });

    it('handles 50% pool', () => {
      const pool = calculatePoolFromPercentage(5000000, 50);
      expect(pool).toBe(5000000);
    });

    it('handles very small percentages', () => {
      const pool = calculatePoolFromPercentage(10000000, 0.1);
      expect(pool).toBe(Math.round((10000000 * 0.001) / 0.999));
    });

    it('handles fractional results', () => {
      const pool = calculatePoolFromPercentage(10000000, 15);
      // 15% of total means pool / (pool + 10M) = 0.15
      // pool = 10M * 0.15 / (1 - 0.15) = 1764705.88...
      expect(pool).toBe(1764705);
    });
  });

  describe('buildModelFromWizard', () => {
    it('builds C-Corp model correctly', () => {
      const result = {
        name: 'Test Corp',
        entityType: 'C_CORP' as EntityType,
        jurisdiction: 'DE',
        currency: 'USD',
        authorized: 10000000,
        parValue: 0.0001,
        poolSize: 2000000,
        poolPct: undefined,
        founders: [
          { name: 'Alice', email: 'alice@test.com', shares: 5000000 },
          { name: 'Bob', shares: 3000000 },
        ],
      };

      const model = buildModelFromWizard(result);

      expect(model.company.name).toBe('Test Corp');
      expect(model.company.entityType).toBe('C_CORP');
      expect(model.company.jurisdiction).toBe('DE');
      expect(model.company.currency).toBe('USD');

      // Check common stock
      const common = model.securityClasses.find((sc) => sc.kind === 'COMMON');
      expect(common?.authorized).toBe(10000000);
      expect(common?.parValue).toBe(0.0001);
      expect(common?.label).toBe('Common Stock');

      // Check pool
      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool?.authorized).toBe(2000000);

      // Check stakeholders
      expect(model.stakeholders).toHaveLength(2);
      expect(model.stakeholders[0].name).toBe('Alice');
      expect(model.stakeholders[0].email).toBe('alice@test.com');
      expect(model.stakeholders[1].name).toBe('Bob');

      // Check issuances
      expect(model.issuances).toHaveLength(2);
      expect(model.issuances[0].qty).toBe(5000000);
      expect(model.issuances[1].qty).toBe(3000000);
    });

    it('builds LLC model correctly', () => {
      const result = {
        name: 'Test LLC',
        entityType: 'LLC' as EntityType,
        jurisdiction: 'CA',
        currency: 'USD',
        authorized: 1000000,
        parValue: undefined,
        poolSize: undefined,
        poolPct: undefined,
        founders: [{ name: 'Charlie', shares: 1000000 }],
      };

      const model = buildModelFromWizard(result);

      expect(model.company.entityType).toBe('LLC');

      // Check common units
      const common = model.securityClasses.find((sc) => sc.kind === 'COMMON');
      expect(common?.authorized).toBe(1000000);
      expect(common?.parValue).toBeUndefined();
      expect(common?.label).toBe('Common Units');

      // No pool for LLC
      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool).toBeUndefined();
    });

    it('calculates pool from percentage', () => {
      const result = {
        name: 'Test Corp',
        entityType: 'C_CORP' as EntityType,
        jurisdiction: 'DE',
        currency: 'USD',
        authorized: 10000000,
        parValue: 0.0001,
        poolSize: undefined,
        poolPct: 20,
        founders: [{ name: 'Alice', shares: 8000000 }],
      };

      const model = buildModelFromWizard(result);

      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool?.authorized).toBe(2000000); // 20% of total
    });

    it('handles no founders', () => {
      const result = {
        name: 'Empty Corp',
        entityType: 'C_CORP' as EntityType,
        jurisdiction: 'DE',
        currency: 'USD',
        authorized: 10000000,
        parValue: 0.0001,
        poolSize: 1000000,
        poolPct: undefined,
        founders: [],
      };

      const model = buildModelFromWizard(result);

      expect(model.stakeholders).toHaveLength(0);
      expect(model.issuances).toHaveLength(0);

      // Pool still created
      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool?.authorized).toBe(1000000);
    });

    it('builds S-Corp model correctly', () => {
      const result = {
        name: 'Test S-Corp',
        entityType: 'S_CORP' as EntityType,
        jurisdiction: 'NY',
        currency: 'USD',
        authorized: 5000000,
        parValue: 0.001,
        poolSize: 500000,
        poolPct: undefined,
        founders: [{ name: 'Sarah', shares: 4500000 }],
      };

      const model = buildModelFromWizard(result);

      expect(model.company.entityType).toBe('S_CORP');

      const common = model.securityClasses.find((sc) => sc.kind === 'COMMON');
      expect(common?.label).toBe('Common Stock');
      expect(common?.parValue).toBe(0.001);

      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool?.authorized).toBe(500000);
    });

    it('handles no pool for non-corp entities', () => {
      const result = {
        name: 'No Pool LLC',
        entityType: 'LLC' as EntityType,
        jurisdiction: 'TX',
        currency: 'USD',
        authorized: 2000000,
        parValue: undefined,
        poolSize: 0,
        poolPct: 0,
        founders: [{ name: 'Mike', shares: 2000000 }],
      };

      const model = buildModelFromWizard(result);

      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool).toBeUndefined();
    });

    it('handles founders with email and without email mixed', () => {
      const result = {
        name: 'Mixed Corp',
        entityType: 'C_CORP' as EntityType,
        jurisdiction: 'DE',
        currency: 'EUR',
        authorized: 10000000,
        parValue: 0.0001,
        poolSize: undefined,
        poolPct: 10,
        founders: [
          { name: 'Alice', email: 'alice@test.com', shares: 3000000 },
          { name: 'Bob', shares: 2000000 },
          { name: 'Charlie', email: 'charlie@test.com', shares: 4000000 },
        ],
      };

      const model = buildModelFromWizard(result);

      expect(model.stakeholders).toHaveLength(3);
      expect(model.stakeholders[0].email).toBe('alice@test.com');
      expect(model.stakeholders[1].email).toBeUndefined();
      expect(model.stakeholders[2].email).toBe('charlie@test.com');

      expect(model.issuances).toHaveLength(3);
      expect(model.issuances.reduce((sum, i) => sum + i.qty, 0)).toBe(9000000);

      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool?.authorized).toBe(1000000); // 10% of total
    });

    it('handles both poolSize and poolPct with poolSize taking precedence', () => {
      const result = {
        name: 'Both Pool Corp',
        entityType: 'C_CORP' as EntityType,
        jurisdiction: 'DE',
        currency: 'USD',
        authorized: 10000000,
        parValue: 0.0001,
        poolSize: 3000000, // This should take precedence
        poolPct: 20, // This would be 2000000 if calculated
        founders: [{ name: 'Dan', shares: 7000000 }],
      };

      const model = buildModelFromWizard(result);

      const pool = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      expect(pool?.authorized).toBe(3000000); // poolSize takes precedence
    });

    it('includes formationDate in wizard result', () => {
      const result = {
        name: 'Date Corp',
        formationDate: '2024-06-15',
        entityType: 'C_CORP' as EntityType,
        jurisdiction: 'DE',
        currency: 'USD',
        authorized: 10000000,
        parValue: 0.0001,
        poolSize: undefined,
        poolPct: undefined,
        founders: [],
      };

      const model = buildModelFromWizard(result);

      expect(model.company.formationDate).toBe('2024-06-15');
    });
  });
});
