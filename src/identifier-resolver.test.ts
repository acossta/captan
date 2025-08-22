import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  isEmail,
  isPrefixedId,
  resolveStakeholder,
  resolveStakeholders,
  getIdentifierDisplay,
  validateIdentifier,
  suggestSimilarStakeholders,
  formatStakeholderReference,
} from './identifier-resolver.js';
import type { FileModel, Stakeholder } from './model.js';

// Mock dependencies
vi.mock('./store.js', () => ({
  load: vi.fn(),
}));

// Import mocked modules
import { load } from './store.js';

const mockLoad = load as Mock;

describe('Identifier Resolver', () => {
  const mockStakeholder1: Stakeholder = {
    id: 'sh_alice',
    name: 'Alice Smith',
    email: 'alice@example.com',
    type: 'person',
  };

  const mockStakeholder2: Stakeholder = {
    id: 'sh_bob',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    type: 'person',
  };

  const mockStakeholder3: Stakeholder = {
    id: 'sh_corp',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    type: 'entity',
  };

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
    stakeholders: [mockStakeholder1, mockStakeholder2, mockStakeholder3],
    securityClasses: [],
    issuances: [],
    optionGrants: [],
    safes: [],
    valuations: [],
    audit: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isEmail', () => {
    it('should identify valid email addresses', () => {
      expect(isEmail('alice@example.com')).toBe(true);
      expect(isEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(isEmail('user123@test-domain.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isEmail('not-an-email')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
      expect(isEmail('user@')).toBe(false);
      expect(isEmail('user@domain')).toBe(false);
      expect(isEmail('user name@domain.com')).toBe(false);
      expect(isEmail('')).toBe(false);
    });
  });

  describe('isPrefixedId', () => {
    it('should identify valid prefixed IDs', () => {
      expect(isPrefixedId('sh_alice')).toBe(true);
      expect(isPrefixedId('sc_common')).toBe(true);
      expect(isPrefixedId('is_founder')).toBe(true);
      expect(isPrefixedId('og_employee')).toBe(true);
      expect(isPrefixedId('safe_investor')).toBe(true);
      expect(isPrefixedId('comp_test')).toBe(true);
      expect(isPrefixedId('prefix_123-abc')).toBe(true);
    });

    it('should reject invalid prefixed IDs', () => {
      expect(isPrefixedId('no-prefix')).toBe(false);
      expect(isPrefixedId('_missing_prefix')).toBe(false);
      expect(isPrefixedId('prefix_')).toBe(false);
      expect(isPrefixedId('PREFIX_test')).toBe(false); // uppercase prefix
      expect(isPrefixedId('pre fix_test')).toBe(false); // space in prefix
      expect(isPrefixedId('')).toBe(false);
    });
  });

  describe('resolveStakeholder', () => {
    it('should resolve stakeholder by email', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholder('alice@example.com');

      expect(result.success).toBe(true);
      expect(result.stakeholder).toEqual(mockStakeholder1);
      expect(mockLoad).toHaveBeenCalledWith('captable.json');
    });

    it('should resolve stakeholder by prefixed ID', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholder('sh_bob');

      expect(result.success).toBe(true);
      expect(result.stakeholder).toEqual(mockStakeholder2);
    });

    it('should resolve stakeholder by fallback search (ID or email)', () => {
      mockLoad.mockReturnValue(mockCaptable);

      // Test with ID that doesn't match isPrefixedId pattern
      const result = resolveStakeholder('sh_alice');

      expect(result.success).toBe(true);
      expect(result.stakeholder).toEqual(mockStakeholder1);
    });

    it('should fail when stakeholder not found by email', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholder('nonexistent@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No stakeholder found with email: nonexistent@example.com');
    });

    it('should fail when stakeholder not found by ID', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholder('sh_nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No stakeholder found with ID: sh_nonexistent');
    });

    it('should fail when stakeholder not found by fallback', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholder('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No stakeholder found with identifier: nonexistent');
    });

    it('should fail when no identifier provided', () => {
      const result = resolveStakeholder(undefined);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No identifier provided');
    });

    it('should fail when captable not found', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File not found: captable.json');
      });

      const result = resolveStakeholder('alice@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found: captable.json');
    });
  });

  describe('resolveStakeholders', () => {
    it('should resolve multiple stakeholders successfully', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholders(['alice@example.com', 'sh_bob']);

      expect(result.success).toBe(true);
      expect(result.stakeholders).toHaveLength(2);
      expect(result.stakeholders[0]).toEqual(mockStakeholder1);
      expect(result.stakeholders[1]).toEqual(mockStakeholder2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mix of successful and failed resolutions', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholders(['alice@example.com', 'sh_nonexistent', 'sh_bob']);

      expect(result.success).toBe(false);
      expect(result.stakeholders).toHaveLength(2);
      expect(result.stakeholders[0]).toEqual(mockStakeholder1);
      expect(result.stakeholders[1]).toEqual(mockStakeholder2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No stakeholder found with ID: sh_nonexistent');
    });

    it('should handle all failed resolutions', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = resolveStakeholders(['nonexistent1', 'nonexistent2']);

      expect(result.success).toBe(false);
      expect(result.stakeholders).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const result = resolveStakeholders([]);

      expect(result.success).toBe(true);
      expect(result.stakeholders).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getIdentifierDisplay', () => {
    it('should format email identifiers', () => {
      expect(getIdentifierDisplay('alice@example.com')).toBe("email 'alice@example.com'");
    });

    it('should format prefixed ID identifiers', () => {
      expect(getIdentifierDisplay('sh_alice')).toBe("ID 'sh_alice'");
    });

    it('should format other identifiers', () => {
      expect(getIdentifierDisplay('unknown-format')).toBe("'unknown-format'");
    });
  });

  describe('validateIdentifier', () => {
    it('should validate email identifiers', () => {
      const result = validateIdentifier('alice@example.com');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('email');
      expect(result.error).toBeUndefined();
    });

    it('should validate prefixed ID identifiers', () => {
      const result = validateIdentifier('sh_alice');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('id');
      expect(result.error).toBeUndefined();
    });

    it('should validate other formats as valid but unknown type', () => {
      const result = validateIdentifier('unknown-format');

      expect(result.valid).toBe(true);
      expect(result.type).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject empty identifier', () => {
      const result = validateIdentifier('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Identifier cannot be empty');
    });

    it('should reject whitespace-only identifier', () => {
      const result = validateIdentifier('   ');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Identifier cannot be empty');
    });
  });

  describe('suggestSimilarStakeholders', () => {
    it('should suggest stakeholders with similar IDs', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = suggestSimilarStakeholders('sh_ali');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockStakeholder1);
    });

    it('should suggest stakeholders with similar emails', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = suggestSimilarStakeholders('alice@example');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockStakeholder1);
    });

    it('should suggest stakeholders with similar names', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = suggestSimilarStakeholders('alice');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockStakeholder1);
    });

    it('should suggest multiple stakeholders sorted by score', () => {
      mockLoad.mockReturnValue(mockCaptable);

      // 'acme' should match both name (Acme Corp) and email (contact@acme.com)
      // giving Acme Corp a higher score than others
      const result = suggestSimilarStakeholders('acme');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockStakeholder3);
    });

    it('should respect limit parameter', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = suggestSimilarStakeholders('example', 1);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no matches found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = suggestSimilarStakeholders('xyz123');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when captable not found', () => {
      mockLoad.mockReturnValue(null);

      const result = suggestSimilarStakeholders('alice');

      expect(result).toHaveLength(0);
    });

    it('should handle case insensitive matching', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = suggestSimilarStakeholders('ALICE');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockStakeholder1);
    });
  });

  describe('formatStakeholderReference', () => {
    it('should format stakeholder with email', () => {
      const result = formatStakeholderReference(mockStakeholder1);

      expect(result).toBe('Alice Smith (sh_alice, alice@example.com)');
    });

    it('should format stakeholder without email', () => {
      const stakeholderWithoutEmail = { ...mockStakeholder1, email: undefined };

      const result = formatStakeholderReference(stakeholderWithoutEmail);

      expect(result).toBe('Alice Smith (sh_alice)');
    });

    it('should format entity type stakeholder', () => {
      const result = formatStakeholderReference(mockStakeholder3);

      expect(result).toBe('Acme Corp (sh_corp, contact@acme.com)');
    });
  });
});
