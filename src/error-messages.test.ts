import { describe, it, expect } from 'vitest';
import { validateCaptable, validateCaptableExtended } from './schema.js';
import {
  ISODateSchema,
  UUIDSchema,
  PrefixedIdSchema,
  CurrencyCodeSchema,
  EmailSchema,
  PercentageSchema,
} from './model.js';
import { z } from 'zod';

describe('Error Message Quality', () => {
  describe('Format validator error messages', () => {
    it('should provide clear date format error', () => {
      try {
        ISODateSchema.parse('01/01/2024');
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors[0].message;
          expect(message).toContain('Date must be in YYYY-MM-DD format');
          expect(message).not.toContain('undefined');
          expect(message).not.toContain('null');
        }
      }
    });

    it('should provide clear UUID format error', () => {
      try {
        UUIDSchema.parse('not-a-uuid');
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors[0].message;
          expect(message).toContain('Invalid UUID format');
        }
      }
    });

    it('should provide clear ID format error', () => {
      try {
        PrefixedIdSchema.parse('InvalidID');
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors[0].message;
          expect(message).toContain('ID must be in format: prefix_identifier');
        }
      }
    });

    it('should provide clear currency code error', () => {
      try {
        CurrencyCodeSchema.parse('US');
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Could be either length or pattern error
          const messages = error.errors.map((e) => e.message).join(' ');
          expect(messages).toMatch(
            /String must contain exactly 3 character|Currency must be a 3-letter ISO 4217 code/
          );
        }
      }
    });

    it('should provide clear email error', () => {
      try {
        EmailSchema.parse('not-an-email');
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors[0].message;
          expect(message).toContain('Invalid email address');
        }
      }
    });

    it('should provide clear percentage range error', () => {
      try {
        PercentageSchema.parse(1.5);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors[0].message;
          expect(message).toContain('Percentage must be between 0 and 1');
        }
      }
    });
  });

  describe('Schema validation error messages', () => {
    it('should provide clear path information for nested errors', () => {
      const invalidData = {
        version: 1,
        company: {
          id: 'comp_test',
          name: 'Test Corp',
          formationDate: '2024-13-01', // Invalid month
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptable(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('company.formationDate');
      // The refine function gives 'Invalid date' error for dates that pass regex but are invalid
      expect(result.errors?.[0]).toMatch(/Invalid date|Date must be in YYYY-MM-DD format/);
    });

    it('should aggregate multiple errors clearly', () => {
      const multipleErrors = {
        version: 1,
        company: {
          id: 'INVALID', // Wrong format
          name: 'Test',
          currency: 'US', // Too short
        },
        stakeholders: [
          {
            id: 'invalid id', // Space in ID
            type: 'person',
            name: 'Test',
            email: 'bad-email', // Invalid email
          },
        ],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptable(multipleErrors);
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(1);

      // Check that each error has clear path
      result.errors?.forEach((error) => {
        expect(error).toMatch(/^[a-zA-Z0-9.\[\]]+:/); // Starts with a path
      });
    });

    it('should provide actionable business rule violations', () => {
      const businessRuleViolation = {
        version: 1,
        company: {
          id: 'comp_test',
          name: 'Test Corp',
        },
        stakeholders: [{ id: 'sh_1', type: 'person', name: 'Person 1' }],
        securityClasses: [{ id: 'sc_common', kind: 'COMMON', label: 'Common', authorized: 1000 }],
        issuances: [
          {
            id: 'is_1',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_1',
            qty: 2000, // Exceeds authorized
            pps: 1,
            date: '2024-01-01',
          },
        ],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(businessRuleViolation);
      expect(result.valid).toBe(false);

      const error = result.errors?.[0];
      expect(error).toContain('Common'); // Security class label
      expect(error).toContain('2000'); // Issued amount
      expect(error).toContain('1000'); // Authorized amount
      expect(error).toContain('exceed'); // Clear verb
    });

    it('should distinguish between errors and warnings clearly', () => {
      const withWarnings = {
        version: 1,
        company: {
          id: 'comp_test',
          name: 'Test Corp',
          formationDate: '2024-01-01',
        },
        stakeholders: [
          { id: 'sh_orphan', type: 'person', name: 'Orphan' }, // No equity
          { id: 'sh_holder', type: 'person', name: 'Holder' },
        ],
        securityClasses: [{ id: 'sc_common', kind: 'COMMON', label: 'Common', authorized: 10000 }],
        issuances: [
          {
            id: 'is_1',
            securityClassId: 'sc_common',
            stakeholderId: 'sh_holder',
            qty: 1000,
            pps: 1,
            date: '2023-12-01', // Before formation
          },
        ],
        optionGrants: [],
        safes: [
          {
            id: 'safe_1',
            stakeholderId: 'sh_holder',
            amount: 100000,
            date: '2024-02-01',
            // No cap or discount
          },
        ],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(withWarnings);
      expect(result.valid).toBe(true); // Warnings don't invalidate
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);

      // Check warning quality
      const orphanWarning = result.warnings?.find((w) => w.message.includes('no equity'));
      expect(orphanWarning).toBeDefined();
      expect(orphanWarning?.path).toContain('sh_orphan');
      expect(orphanWarning?.severity).toBe('info');

      const dateWarning = result.warnings?.find((w) =>
        w.message.includes('before company formation')
      );
      expect(dateWarning).toBeDefined();
      expect(dateWarning?.path).toContain('issuances');

      const safeWarning = result.warnings?.find((w) =>
        w.message.includes('neither cap nor discount')
      );
      expect(safeWarning).toBeDefined();
      expect(safeWarning?.path).toContain('safes');
    });

    it('should provide helpful messages for reference errors', () => {
      const badReferences = {
        version: 1,
        company: {
          id: 'comp_test',
          name: 'Test Corp',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [
          {
            id: 'is_1',
            securityClassId: 'sc_missing',
            stakeholderId: 'sh_missing',
            qty: 1000,
            pps: 1,
            date: '2024-01-01',
          },
        ],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(badReferences);
      expect(result.valid).toBe(false);

      // Should specify which reference is invalid
      expect(
        result.errors?.some((e) => e.includes('stakeholderId') && e.includes('sh_missing'))
      ).toBe(true);
      expect(
        result.errors?.some((e) => e.includes('securityClassId') && e.includes('sc_missing'))
      ).toBe(true);

      // Should include the index for easier debugging
      expect(result.errors?.some((e) => e.includes('issuances[0]'))).toBe(true);
    });

    it('should handle version mismatch errors clearly', () => {
      const oldVersion = {
        version: 0, // Below minimum
        company: { id: 'comp_test', name: 'Test' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptableExtended(oldVersion);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('version 0');
      expect(result.errors?.[0]).toContain('too old');
      expect(result.errors?.[0]).toContain('Minimum supported version');
      expect(result.errors?.[0]).toContain('migrate');
    });
  });

  describe('Error message formatting', () => {
    it('should not expose internal implementation details', () => {
      const testData = {
        version: 1,
        company: {
          id: 123, // Wrong type
          name: 'Test',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptable(testData);
      expect(result.valid).toBe(false);

      // Should not contain technical jargon
      result.errors?.forEach((error) => {
        expect(error).not.toContain('ZodError');
        expect(error).not.toContain('instanceof');
        expect(error).not.toContain('undefined');
        expect(error).not.toContain('null');
      });
    });

    it('should use consistent terminology', () => {
      const testData = {
        version: 1,
        company: { id: 'comp_test', name: 'Test' },
        stakeholders: [{ id: 'sh_1', type: 'invalid_type', name: 'Test' }],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const result = validateCaptable(testData);
      expect(result.valid).toBe(false);

      // Should use consistent case and terminology
      const error = result.errors?.[0];
      if (error) {
        // Path should use dot notation consistently
        // Zod uses dot notation for arrays: stakeholders.0.type
        expect(error).toMatch(/stakeholders\.\d+\.type/);
      }
    });
  });
});
