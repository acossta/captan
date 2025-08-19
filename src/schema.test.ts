import { describe, it, expect } from 'vitest';
import {
  validateCaptable,
  validateCaptableExtended,
  generateJsonSchema,
  getSchemaString,
  isVersionSupported,
  getMigrationInstructions,
  CURRENT_SCHEMA_VERSION,
  MIN_SUPPORTED_VERSION,
  MAX_SUPPORTED_VERSION,
} from './schema.js';
import { FileModel } from './model.js';

describe('Schema Validation', () => {
  const validModel: FileModel = {
    version: 1,
    company: {
      id: 'comp_123',
      name: 'Test Corp',
      formationDate: '2024-01-01',
      entityType: 'C_CORP',
      jurisdiction: 'DE',
      currency: 'USD',
    },
    stakeholders: [
      {
        id: 'sh_alice',
        type: 'person',
        name: 'Alice Founder',
        email: 'alice@test.com',
      },
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
        id: 'is_001',
        securityClassId: 'sc_common',
        stakeholderId: 'sh_alice',
        qty: 1000000,
        pps: 0.0001,
        date: '2024-01-01',
      },
    ],
    optionGrants: [],
    safes: [],
    valuations: [],
    audit: [],
  };

  describe('Basic validation', () => {
    it('should validate a correct captable', () => {
      const result = validateCaptable(validModel);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid date format', () => {
      const invalid = {
        ...validModel,
        company: {
          ...validModel.company,
          formationDate: '01/01/2024', // Wrong format
        },
      };
      const result = validateCaptable(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Date must be in YYYY-MM-DD format');
    });

    it('should reject invalid ID format', () => {
      const invalid = {
        ...validModel,
        stakeholders: [
          {
            id: 'invalid id with spaces', // Invalid format
            type: 'person',
            name: 'Test',
          },
        ],
      };
      const result = validateCaptable(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('ID must be in format');
    });

    it('should reject invalid email', () => {
      const invalid = {
        ...validModel,
        stakeholders: [
          {
            id: 'sh_test',
            type: 'person',
            name: 'Test',
            email: 'not-an-email', // Invalid email
          },
        ],
      };
      const result = validateCaptable(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid email');
    });

    it('should reject invalid currency code', () => {
      const invalid = {
        ...validModel,
        company: {
          ...validModel.company,
          currency: 'US', // Should be 3 letters
        },
      };
      const result = validateCaptable(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('String must contain exactly 3 character');
    });

    it('should validate proper valuation schema', () => {
      const withValuation = {
        ...validModel,
        valuations: [
          {
            id: 'val_001',
            date: '2024-06-01',
            type: '409a',
            preMoney: 10000000,
            postMoney: 15000000,
            sharePrice: 1.5,
            methodology: 'Market approach',
            provider: 'Valuation Firm LLC',
          },
        ],
      };
      const result = validateCaptable(withValuation);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid valuation type', () => {
      const invalid = {
        ...validModel,
        valuations: [
          {
            id: 'val_001',
            date: '2024-06-01',
            type: 'invalid_type', // Invalid type
            preMoney: 10000000,
          },
        ],
      };
      const result = validateCaptable(invalid);
      expect(result.valid).toBe(false);
    });
  });

  describe('Extended validation with business rules', () => {
    it('should pass extended validation for valid model', () => {
      const result = validateCaptableExtended(validModel);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect invalid stakeholder references', () => {
      const invalid = {
        ...validModel,
        issuances: [
          {
            id: 'is_001',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_nonexistent', // Doesn't exist
            qty: 1000000,
            pps: 0.0001,
            date: '2024-01-01',
          },
        ],
      };
      const result = validateCaptableExtended(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid stakeholderId reference');
    });

    it('should detect invalid security class references', () => {
      const invalid = {
        ...validModel,
        issuances: [
          {
            id: 'is_001',
            securityClassId: 'sc_nonexistent', // Doesn't exist
            stakeholderId: 'sh_alice',
            qty: 1000000,
            pps: 0.0001,
            date: '2024-01-01',
          },
        ],
      };
      const result = validateCaptableExtended(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid securityClassId reference');
    });

    it('should detect when issued shares exceed authorized', () => {
      const invalid = {
        ...validModel,
        securityClasses: [
          {
            id: 'sc_common',
            kind: 'COMMON' as const,
            label: 'Common Stock',
            authorized: 1000, // Low authorized amount
            parValue: 0.0001,
          },
        ],
        issuances: [
          {
            id: 'is_001',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_alice',
            qty: 10000, // Exceeds authorized
            pps: 0.0001,
            date: '2024-01-01',
          },
        ],
      };
      const result = validateCaptableExtended(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('exceed authorized');
    });

    it('should detect duplicate IDs', () => {
      const invalid = {
        ...validModel,
        stakeholders: [
          {
            id: 'sh_alice',
            type: 'person' as const,
            name: 'Alice',
          },
          {
            id: 'sh_alice', // Duplicate ID
            type: 'person' as const,
            name: 'Alice 2',
          },
        ],
      };
      const result = validateCaptableExtended(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Duplicate ID found');
    });

    it('should warn about orphaned stakeholders', () => {
      const withOrphan = {
        ...validModel,
        stakeholders: [
          ...validModel.stakeholders,
          {
            id: 'sh_orphan',
            type: 'person' as const,
            name: 'Orphan Stakeholder',
          },
        ],
      };
      const result = validateCaptableExtended(withOrphan);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain('has no equity');
    });

    it('should warn about SAFEs without cap or discount', () => {
      const withSafe = {
        ...validModel,
        safes: [
          {
            id: 'safe_001',
            stakeholderId: 'sh_alice',
            amount: 100000,
            date: '2024-01-15',
            // No cap or discount
          },
        ],
      };
      const result = validateCaptableExtended(withSafe);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain('neither cap nor discount');
    });

    it('should warn about dates before formation', () => {
      const invalid = {
        ...validModel,
        issuances: [
          {
            id: 'is_001',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_alice',
            qty: 1000000,
            pps: 0.0001,
            date: '2023-12-01', // Before formation date
          },
        ],
      };
      const result = validateCaptableExtended(invalid);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain('before company formation');
    });

    it('should validate option grants exceed pool', () => {
      const withPool = {
        ...validModel,
        securityClasses: [
          ...validModel.securityClasses,
          {
            id: 'sc_pool',
            kind: 'OPTION_POOL' as const,
            label: 'Option Pool',
            authorized: 1000,
          },
        ],
        optionGrants: [
          {
            id: 'og_001',
            stakeholderId: 'sh_alice',
            qty: 2000, // Exceeds pool
            exercise: 1.0,
            grantDate: '2024-02-01',
          },
        ],
      };
      const result = validateCaptableExtended(withPool);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('exceed option pool');
    });

    it('should warn when vesting starts before grant date', () => {
      const withBackVesting = {
        ...validModel,
        securityClasses: [
          ...validModel.securityClasses,
          {
            id: 'sc_pool',
            kind: 'OPTION_POOL' as const,
            label: 'Option Pool',
            authorized: 2000000,
          },
        ],
        optionGrants: [
          {
            id: 'og_001',
            stakeholderId: 'sh_alice',
            qty: 1000,
            exercise: 1.0,
            grantDate: '2024-06-01',
            vesting: {
              start: '2024-01-01', // Before grant date
              monthsTotal: 48,
              cliffMonths: 12,
            },
          },
        ],
      };
      const result = validateCaptableExtended(withBackVesting);
      expect(result.valid).toBe(true); // Just a warning, not an error
      expect(result.warnings).toBeDefined();
      expect(
        result.warnings?.find((w) => w.message.includes('Vesting start date is before grant date'))
      ).toBeDefined();
    });

    it('should detect invalid option grant stakeholder references', () => {
      const withInvalidGrant = {
        ...validModel,
        optionGrants: [
          {
            id: 'og_001',
            stakeholderId: 'sh_nonexistent', // Invalid reference
            qty: 1000,
            exercise: 1.0,
            grantDate: '2024-01-01',
          },
        ],
      };
      const result = validateCaptableExtended(withInvalidGrant);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid stakeholderId reference: sh_nonexistent');
    });

    it('should handle multiple validation errors and warnings', () => {
      const withMultipleIssues = {
        ...validModel,
        stakeholders: [
          ...validModel.stakeholders,
          {
            id: 'sh_orphan',
            type: 'person' as const,
            name: 'Orphan Person',
          },
        ],
        issuances: [
          ...validModel.issuances,
          {
            id: 'is_002',
            securityClassId: 'sc_invalid', // Invalid reference
            stakeholderId: 'sh_invalid', // Invalid reference
            qty: 1000,
            pps: 0.01,
            date: '2023-01-01', // Before formation
          },
        ],
        safes: [
          {
            id: 'safe_001',
            stakeholderId: 'sh_alice',
            amount: 100000,
            date: '2024-03-01',
            // No cap or discount - warning
          },
        ],
      };
      const result = validateCaptableExtended(withMultipleIssues);
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(1);
      expect(result.warnings?.length).toBeGreaterThan(1);
    });
  });

  describe('JSON Schema generation', () => {
    it('should generate valid JSON Schema', () => {
      const schema = generateJsonSchema();
      expect(schema).toBeDefined();
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.title).toBe('Captan Captable Schema');
    });

    it('should include descriptions in generated schema', () => {
      const schemaStr = getSchemaString();
      const schema = JSON.parse(schemaStr);

      // Check that descriptions are included
      expect(schemaStr).toContain('Schema version number');
      expect(schemaStr).toContain('Legal company name');
      expect(schemaStr).toContain('List of all stakeholders');
    });

    it('should export schema string correctly', () => {
      const schemaStr = getSchemaString();
      expect(schemaStr).toBeTruthy();
      expect(() => JSON.parse(schemaStr)).not.toThrow();
    });
  });

  describe('Schema versioning', () => {
    it('should support current version', () => {
      expect(isVersionSupported(CURRENT_SCHEMA_VERSION)).toBe(true);
    });

    it('should support minimum version', () => {
      expect(isVersionSupported(MIN_SUPPORTED_VERSION)).toBe(true);
    });

    it('should support maximum version', () => {
      expect(isVersionSupported(MAX_SUPPORTED_VERSION)).toBe(true);
    });

    it('should reject versions below minimum', () => {
      expect(isVersionSupported(MIN_SUPPORTED_VERSION - 1)).toBe(false);
    });

    it('should reject versions above maximum', () => {
      expect(isVersionSupported(MAX_SUPPORTED_VERSION + 1)).toBe(false);
    });

    it('should detect old schema version in extended validation', () => {
      const oldModel = {
        ...validModel,
        version: MIN_SUPPORTED_VERSION - 1,
      };
      const result = validateCaptableExtended(oldModel);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('too old');
    });

    it('should detect newer schema version in extended validation', () => {
      const newModel = {
        ...validModel,
        version: MAX_SUPPORTED_VERSION + 1,
      };
      const result = validateCaptableExtended(newModel);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('newer than supported');
    });

    it('should warn about outdated but supported version', () => {
      // This test only makes sense when we have multiple supported versions
      // For now, skip if MIN === CURRENT
      if (MIN_SUPPORTED_VERSION === CURRENT_SCHEMA_VERSION) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const outdatedModel = {
        ...validModel,
        version: MIN_SUPPORTED_VERSION,
      };
      const result = validateCaptableExtended(outdatedModel);
      expect(result.valid).toBe(true);
      expect(result.warnings?.find((w) => w.path === 'version')).toBeDefined();
    });

    it('should return empty migration instructions for same version', () => {
      const instructions = getMigrationInstructions(1, 1);
      expect(instructions).toEqual([]);
    });
  });
});
