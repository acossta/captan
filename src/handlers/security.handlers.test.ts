import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  handleSecurityAdd,
  handleSecurityList,
  handleSecurityShow,
  handleSecurityUpdate,
  handleSecurityDelete,
} from './security.handlers.js';
import type { FileModel, SecurityClass, Issuance } from '../model.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  createSecurityClass: vi.fn(),
  getIssuedShares: vi.fn(),
  logAction: vi.fn(),
}));

// Import mocked modules
import { load, save } from '../store.js';
import * as helpers from '../services/helpers.js';

const mockLoad = load as Mock;
const mockSave = save as Mock;
const mockCreateSecurityClass = helpers.createSecurityClass as Mock;
const mockGetIssuedShares = helpers.getIssuedShares as Mock;
const mockLogAction = helpers.logAction as Mock;

describe('Security Handlers', () => {
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
    securityClasses: [
      {
        id: 'sc_common',
        kind: 'COMMON',
        label: 'Common Stock',
        authorized: 10000000,
        parValue: 0.001,
      },
    ],
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
    safes: [],
    valuations: [],
    audit: [],
  };

  const mockSecurityClass: SecurityClass = {
    id: 'sc_new',
    kind: 'PREFERRED',
    label: 'Series A Preferred',
    authorized: 5000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSecurityAdd', () => {
    it('should successfully add a common stock security class', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCreateSecurityClass.mockReturnValue(mockSecurityClass);

      const result = handleSecurityAdd({
        kind: 'common',
        label: 'Common Stock',
        authorized: '10000000',
        par: '0.001',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Added security class "Common Stock"');
      expect(result.message).toContain('sc_new');
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'COMMON',
        'Common Stock',
        10000000,
        0.001
      );
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should successfully add a preferred stock security class', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCreateSecurityClass.mockReturnValue(mockSecurityClass);

      const result = handleSecurityAdd({
        kind: 'PREFERRED',
        label: 'Series A Preferred',
        authorized: '5000000',
      });

      expect(result.success).toBe(true);
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'PREFERRED',
        'Series A Preferred',
        5000000,
        undefined
      );
    });

    it('should successfully add an option pool security class', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCreateSecurityClass.mockReturnValue({ ...mockSecurityClass, kind: 'OPTION_POOL' });

      const result = handleSecurityAdd({
        kind: 'option_pool',
        label: 'Employee Option Pool',
        authorized: '2000000',
      });

      expect(result.success).toBe(true);
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'OPTION_POOL',
        'Employee Option Pool',
        2000000,
        undefined
      );
    });

    it('should use default authorized amount when not provided', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCreateSecurityClass.mockReturnValue(mockSecurityClass);

      const result = handleSecurityAdd({
        kind: 'common',
        label: 'Common Stock',
      });

      expect(result.success).toBe(true);
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'COMMON',
        'Common Stock',
        10000000,
        undefined
      );
    });

    it('should fail with invalid security kind', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityAdd({
        kind: 'invalid',
        label: 'Invalid Security',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Invalid security kind');
      expect(result.message).toContain('Must be COMMON, PREFERRED, or OPTION_POOL');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleSecurityAdd({
        kind: 'common',
        label: 'Common Stock',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleSecurityAdd({
        kind: 'common',
        label: 'Common Stock',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleSecurityList', () => {
    it('should list security classes in table format by default', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🏦 Security Classes');
      expect(result.message).toContain('sc_common');
      expect(result.message).toContain('COMMON');
      expect(result.message).toContain('Common Stock');
      expect(result.message).toContain('10,000,000');
      expect(result.message).toContain('8,000,000');
      expect(mockGetIssuedShares).toHaveBeenCalledWith(mockCaptable, 'sc_common');
    });

    it('should return JSON format when requested', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityList({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData.length).toBeGreaterThan(0);
      expect(jsonData.some((sc: any) => sc.id === 'sc_common')).toBe(true);
    });

    it('should handle empty security class list', () => {
      const emptyCaptable = { ...mockCaptable, securityClasses: [] };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleSecurityList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No security classes found');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleSecurityList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleSecurityList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });

  describe('handleSecurityShow', () => {
    it('should show security class details with issuances', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityShow('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🏦 Security Class Details');
      expect(result.message).toContain('Common Stock');
      expect(result.message).toContain('sc_common');
      expect(result.message).toContain('COMMON');
      expect(result.message).toContain('10,000,000'); // authorized
      expect(result.message).toContain('8,000,000'); // issued
      expect(result.message).toContain('2,000,000'); // available
      expect(result.message).toContain('80.0%'); // utilization
      expect(result.message).toContain('$0.001'); // par value
      expect(result.message).toContain('📊 Issuances');
      expect(result.message).toContain('Founder');
      expect(mockGetIssuedShares).toHaveBeenCalledWith(mockCaptable, 'sc_common');
    });

    it('should show security class without par value', () => {
      const securityWithoutPar = { ...mockCaptable.securityClasses[0] };
      delete securityWithoutPar.parValue;
      const captableWithoutPar = {
        ...mockCaptable,
        securityClasses: [securityWithoutPar],
      };
      mockLoad.mockReturnValue(captableWithoutPar);
      mockGetIssuedShares.mockReturnValue(0);

      const result = handleSecurityShow('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('Par Value');
    });

    it('should show security class without issuances', () => {
      const captableWithoutIssuances = {
        ...mockCaptable,
        issuances: [],
      };
      mockLoad.mockReturnValue(captableWithoutIssuances);
      mockGetIssuedShares.mockReturnValue(0);

      const result = handleSecurityShow('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Utilization:'); // Shows utilization label
      expect(result.message).not.toContain('📊 Issuances');
    });

    it('should fail when no security ID provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityShow(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a security class ID');
    });

    it('should fail when security class not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityShow('sc_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Security class not found: sc_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleSecurityShow('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });
  });

  describe('handleSecurityUpdate', () => {
    it('should update security class authorized shares', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityUpdate('sc_common', {
        authorized: '15000000',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated security class "Common Stock"');
      expect(result.message).toContain('sc_common');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should update security class label', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityUpdate('sc_common', {
        label: 'Updated Common Stock',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated security class "Updated Common Stock"');
    });

    it('should update both authorized shares and label', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityUpdate('sc_common', {
        authorized: '20000000',
        label: 'Updated Common Stock',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated security class "Updated Common Stock"');
    });

    it('should fail when authorized shares are less than issued', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityUpdate('sc_common', {
        authorized: '5000000', // Less than 8M issued
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        '❌ Cannot set authorized (5,000,000) below issued (8,000,000)'
      );
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no security ID provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityUpdate(undefined, { label: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a security class ID');
    });

    it('should fail when no updates provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityUpdate('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No updates provided');
      expect(result.message).toContain('Use --authorized or --label to update');
    });

    it('should fail when security class not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityUpdate('sc_nonexistent', { label: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Security class not found: sc_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleSecurityUpdate('sc_common', { label: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });
  });

  describe('handleSecurityDelete', () => {
    it('should delete security class without issued shares', () => {
      const captableNoIssuances = {
        ...mockCaptable,
        issuances: [],
      };
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(captableNoIssuances)));
      mockGetIssuedShares.mockReturnValue(0);

      const result = handleSecurityDelete('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted security class');
      expect(result.message).toContain('sc_common');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should force delete security class with issued shares', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityDelete('sc_common', { force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted security class');
      expect(mockSave).toHaveBeenCalled();
    });

    it('should force delete option pool and remove all grants when no pools remain', () => {
      const captableWithOptionPool = {
        ...mockCaptable,
        securityClasses: [
          {
            id: 'sc_option_pool',
            kind: 'OPTION_POOL' as const,
            label: 'Employee Option Pool',
            authorized: 2000000,
          },
        ],
        optionGrants: [
          {
            id: 'og_test',
            stakeholderId: 'sh_founder',
            qty: 100000,
            exercise: 0.1,
            grantDate: '2024-01-01',
          },
        ],
      };
      mockLoad.mockReturnValue(captableWithOptionPool);
      mockGetIssuedShares.mockReturnValue(0);

      const result = handleSecurityDelete('sc_option_pool', { force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted security class "Employee Option Pool"');
    });

    it('should fail to delete security class with issued shares without force', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleSecurityDelete('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Security class has 8,000,000 issued shares');
      expect(result.message).toContain('Use --force to delete anyway');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no security ID provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityDelete(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a security class ID');
    });

    it('should fail when security class not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleSecurityDelete('sc_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Security class not found: sc_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleSecurityDelete('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleSecurityDelete('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });
});
