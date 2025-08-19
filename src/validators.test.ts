import { describe, it, expect } from 'vitest';
import {
  ISODateSchema,
  UUIDSchema,
  PrefixedIdSchema,
  CurrencyCodeSchema,
  EmailSchema,
  PercentageSchema,
} from './model.js';

describe('Custom Validators', () => {
  describe('ISODateSchema', () => {
    it('should accept valid ISO dates', () => {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2000-02-29', // Leap year
        '1900-01-01',
        '2099-12-31',
      ];

      for (const date of validDates) {
        expect(() => ISODateSchema.parse(date)).not.toThrow();
      }
    });

    it('should reject invalid date formats', () => {
      const invalidFormats = [
        '01/01/2024',
        '2024/01/01',
        '2024-1-1',
        '2024-01-1',
        '2024-1-01',
        '24-01-01',
        'January 1, 2024',
        '2024.01.01',
      ];

      for (const date of invalidFormats) {
        expect(() => ISODateSchema.parse(date)).toThrow('Date must be in YYYY-MM-DD format');
      }
    });

    it('should reject invalid dates that match format', () => {
      const invalidDates = [
        '2024-13-01', // Invalid month
        '2024-00-01', // Invalid month
        '2024-02-30', // Invalid day for February
        '2024-04-31', // April has 30 days
        '2023-02-29', // Not a leap year
        '2024-01-00', // Invalid day
        '2024-01-32', // Invalid day
      ];

      for (const date of invalidDates) {
        expect(() => ISODateSchema.parse(date)).toThrow();
      }
    });

    it('should handle edge case dates', () => {
      // These should pass format but might have parsing issues
      // Year 0000 actually passes in modern JS Date parsing
      expect(() => ISODateSchema.parse('0000-01-01')).not.toThrow();
      expect(() => ISODateSchema.parse('9999-12-31')).not.toThrow(); // Far future
    });
  });

  describe('UUIDSchema', () => {
    it('should accept valid UUID v4', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        // Mixed case should work
        'F47AC10B-58CC-4372-A567-0E02B2C3D479',
      ];

      for (const uuid of validUUIDs) {
        expect(() => UUIDSchema.parse(uuid)).not.toThrow();
      }
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        '550e8400-e29b-11d4-a716-446655440000', // Wrong version (not v4)
        '550e8400-e29b-41d4-a716-44665544000', // Too short
        '550e8400-e29b-41d4-a716-4466554400000', // Too long
        '550e8400-e29b-41d4-z716-446655440000', // Invalid character
        '550e8400e29b41d4a716446655440000', // No hyphens
        'not-a-uuid',
        '',
      ];

      for (const uuid of invalidUUIDs) {
        expect(() => UUIDSchema.parse(uuid)).toThrow('Invalid UUID format');
      }
    });

    it('should validate UUID v4 specifically', () => {
      // The 4 in the third group indicates v4
      expect(() => UUIDSchema.parse('550e8400-e29b-31d4-a716-446655440000')).toThrow(); // Not v4
      expect(() => UUIDSchema.parse('550e8400-e29b-51d4-a716-446655440000')).toThrow(); // Not v4
    });
  });

  describe('PrefixedIdSchema', () => {
    it('should accept valid prefixed IDs', () => {
      const validIds = [
        'sc_common',
        'sc_pool',
        'sh_abc123',
        'is_550e8400-e29b-41d4-a716-446655440000',
        'og_test-123',
        'safe_ABC123',
        'val_2024',
      ];

      for (const id of validIds) {
        expect(() => PrefixedIdSchema.parse(id)).not.toThrow();
      }
    });

    it('should reject invalid prefixed IDs', () => {
      const invalidIds = [
        'SC_COMMON', // Uppercase prefix
        'Sc_common', // Mixed case prefix
        'sc common', // Space
        'sc-common', // Hyphen instead of underscore
        '_common', // No prefix
        'sc_', // No identifier
        'sc__test', // Double underscore
        '123_test', // Numeric prefix
        'sc_test!', // Special character
        '',
      ];

      for (const id of invalidIds) {
        expect(() => PrefixedIdSchema.parse(id)).toThrow('ID must be in format: prefix_identifier');
      }
    });

    it('should handle edge cases', () => {
      // Very long IDs should work
      const longId = 'prefix_' + 'a'.repeat(100);
      expect(() => PrefixedIdSchema.parse(longId)).not.toThrow();

      // Single letter prefix should work
      expect(() => PrefixedIdSchema.parse('a_test')).not.toThrow();
    });
  });

  describe('CurrencyCodeSchema', () => {
    it('should accept valid ISO 4217 currency codes', () => {
      const validCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'];

      for (const code of validCodes) {
        expect(() => CurrencyCodeSchema.parse(code)).not.toThrow();
      }
    });

    it('should reject invalid currency codes', () => {
      const invalidCodes = [
        'US', // Too short
        'USDD', // Too long
        'usd', // Lowercase
        'UsD', // Mixed case
        '123', // Numbers
        'US$', // Special character
        '',
      ];

      for (const code of invalidCodes) {
        expect(() => CurrencyCodeSchema.parse(code)).toThrow();
      }
    });

    it('should validate format but not actual ISO codes', () => {
      // These are valid format but not real ISO codes
      // The validator only checks format, not if it's a real currency
      expect(() => CurrencyCodeSchema.parse('XXX')).not.toThrow();
      expect(() => CurrencyCodeSchema.parse('ZZZ')).not.toThrow();
    });
  });

  describe('EmailSchema', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_123@test-domain.org',
        'a@b.co',
      ];

      for (const email of validEmails) {
        expect(() => EmailSchema.parse(email)).not.toThrow();
      }
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        'user@.com',
        'user..name@example.com',
        '',
      ];

      for (const email of invalidEmails) {
        expect(() => EmailSchema.parse(email)).toThrow('Invalid email address');
      }
    });

    it('should handle edge cases', () => {
      // Very long local part
      const longEmail = 'a'.repeat(64) + '@example.com';
      expect(() => EmailSchema.parse(longEmail)).not.toThrow();

      // Multiple subdomains
      expect(() => EmailSchema.parse('user@sub.domain.example.com')).not.toThrow();
    });
  });

  describe('PercentageSchema', () => {
    it('should accept valid percentages', () => {
      const validPercentages = [0, 0.01, 0.5, 0.99, 1, 0.123456789];

      for (const pct of validPercentages) {
        expect(() => PercentageSchema.parse(pct)).not.toThrow();
      }
    });

    it('should reject invalid percentages', () => {
      const invalidPercentages = [-0.01, -1, 1.01, 2, 100, Infinity, -Infinity];

      for (const pct of invalidPercentages) {
        expect(() => PercentageSchema.parse(pct)).toThrow('Percentage must be between 0 and 1');
      }
    });

    it('should handle boundary values', () => {
      expect(() => PercentageSchema.parse(0)).not.toThrow();
      expect(() => PercentageSchema.parse(1)).not.toThrow();

      // JavaScript precision edge cases
      expect(() => PercentageSchema.parse(0.9999999999999999)).not.toThrow();
      // 1.0000000000000001 rounds to 1 due to JavaScript precision
      expect(() => PercentageSchema.parse(1.0000000000000001)).not.toThrow();
      // 1.0000000000000002 actually becomes slightly over 1 after precision
      expect(() => PercentageSchema.parse(1.00001)).toThrow(); // Clearly over 1
      expect(() => PercentageSchema.parse(1.1)).toThrow(); // Clearly over 1
    });

    it('should reject non-numbers', () => {
      expect(() => PercentageSchema.parse('0.5')).toThrow();
      expect(() => PercentageSchema.parse(null)).toThrow();
      expect(() => PercentageSchema.parse(undefined)).toThrow();
      expect(() => PercentageSchema.parse(NaN)).toThrow();
    });
  });
});
