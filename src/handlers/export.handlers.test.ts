import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { handleExportCsv, handleExportJson, handleExportPdf } from './export.handlers.js';
import type {
  FileModel,
  Stakeholder,
  SecurityClass,
  Issuance,
  OptionGrant,
  Vesting,
} from '../model.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  calculateVestedOptions: vi.fn(),
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
}));

// Import mocked modules
import { load } from '../store.js';
import * as helpers from '../services/helpers.js';
import * as fs from 'fs';

const mockLoad = load as Mock;
const mockCalculateVestedOptions = helpers.calculateVestedOptions as Mock;
const mockWriteFileSync = fs.writeFileSync as Mock;

describe('Export Handlers', () => {
  const mockStakeholder: Stakeholder = {
    id: 'sh_founder',
    name: 'Founder',
    email: 'founder@test.com',
    type: 'person',
  };

  const mockEmployee: Stakeholder = {
    id: 'sh_employee',
    name: 'Employee',
    email: 'employee@test.com',
    type: 'person',
  };

  const mockCommonStock: SecurityClass = {
    id: 'sc_common',
    kind: 'COMMON',
    label: 'Common Stock',
    authorized: 10000000,
  };

  const mockOptionPool: SecurityClass = {
    id: 'sc_option_pool',
    kind: 'OPTION_POOL',
    label: 'Employee Option Pool',
    authorized: 2000000,
  };

  const mockIssuance: Issuance = {
    id: 'is_founder',
    stakeholderId: 'sh_founder',
    securityClassId: 'sc_common',
    qty: 8000000,
    pps: 0.001,
    date: '2024-01-01',
  };

  const mockGrant: OptionGrant = {
    id: 'og_employee',
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
    stakeholders: [mockStakeholder, mockEmployee],
    securityClasses: [mockCommonStock, mockOptionPool],
    issuances: [mockIssuance],
    optionGrants: [mockGrant],
    safes: [],
    valuations: [],
    audit: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleExportCsv', () => {
    it('should export cap table to CSV format with shares and options', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000); // 25% vested

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Check header
      expect(csvLines[0]).toBe(
        'Name,Email,Type,Security Class,Quantity,Price Per Share,Date,Vested'
      );

      // Check share issuance row
      expect(csvLines[1]).toBe(
        'Founder,founder@test.com,Shares,Common Stock,8000000,0.001,2024-01-01,8000000'
      );

      // Check option grant row
      expect(csvLines[2]).toBe(
        'Employee,employee@test.com,Options,Employee Option Pool,100000,0.1,2024-01-01,25000'
      );

      expect(mockCalculateVestedOptions).toHaveBeenCalledWith(mockGrant, expect.any(String));
    });

    it('should export to file when output specified', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000);

      const result = handleExportCsv({ output: 'captable.csv' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Exported cap table to captable.csv');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'captable.csv',
        expect.stringContaining('Name,Email,Type')
      );
    });

    it('should exclude options when noOptions is true', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleExportCsv({ noOptions: true });

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Should only have header + share issuance row
      expect(csvLines).toHaveLength(2);
      expect(csvLines[0]).toBe(
        'Name,Email,Type,Security Class,Quantity,Price Per Share,Date,Vested'
      );
      expect(csvLines[1]).toBe(
        'Founder,founder@test.com,Shares,Common Stock,8000000,0.001,2024-01-01,8000000'
      );
      expect(mockCalculateVestedOptions).not.toHaveBeenCalled();
    });

    it('should handle missing stakeholder data', () => {
      const captableWithMissingStakeholder = {
        ...mockCaptable,
        stakeholders: [], // No stakeholders
      };
      mockLoad.mockReturnValue(captableWithMissingStakeholder);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Check share issuance row with empty stakeholder data
      expect(csvLines[1]).toBe(',,Shares,Common Stock,8000000,0.001,2024-01-01,8000000');
    });

    it('should handle missing security class data', () => {
      const captableWithMissingSecurity = {
        ...mockCaptable,
        securityClasses: [], // No security classes
      };
      mockLoad.mockReturnValue(captableWithMissingSecurity);
      mockCalculateVestedOptions.mockReturnValue(25000);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Check share issuance row with empty security class
      expect(csvLines[1]).toBe('Founder,founder@test.com,Shares,,8000000,0.001,2024-01-01,8000000');

      // Check option grant row with default option pool label
      expect(csvLines[2]).toBe(
        'Employee,employee@test.com,Options,Option Pool,100000,0.1,2024-01-01,25000'
      );
    });

    it('should handle issuance without price per share', () => {
      const issuanceWithoutPrice = { ...mockIssuance, pps: undefined };
      const captableWithoutPrice = {
        ...mockCaptable,
        issuances: [issuanceWithoutPrice],
      };
      mockLoad.mockReturnValue(captableWithoutPrice);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Check share issuance row with empty price
      expect(csvLines[1]).toBe(
        'Founder,founder@test.com,Shares,Common Stock,8000000,,2024-01-01,8000000'
      );
    });

    it('should handle stakeholder without email', () => {
      const stakeholderWithoutEmail = { ...mockStakeholder, email: undefined };
      const captableWithoutEmail = {
        ...mockCaptable,
        stakeholders: [stakeholderWithoutEmail, mockEmployee],
      };
      mockLoad.mockReturnValue(captableWithoutEmail);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Check share issuance row with empty email
      expect(csvLines[1]).toBe('Founder,,Shares,Common Stock,8000000,0.001,2024-01-01,8000000');
    });

    it('should handle option grant without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const captableWithoutVesting = {
        ...mockCaptable,
        optionGrants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(captableWithoutVesting);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Check option grant row - should show full quantity as vested
      expect(csvLines[2]).toBe(
        'Employee,employee@test.com,Options,Employee Option Pool,100000,0.1,2024-01-01,100000'
      );
      expect(mockCalculateVestedOptions).not.toHaveBeenCalled();
    });

    it('should handle empty issuances and grants', () => {
      const emptyCaptable = {
        ...mockCaptable,
        issuances: [],
        optionGrants: [],
      };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Should only have header
      expect(csvLines).toHaveLength(1);
      expect(csvLines[0]).toBe(
        'Name,Email,Type,Security Class,Quantity,Price Per Share,Date,Vested'
      );
    });

    it('should handle undefined issuances and grants', () => {
      const captableWithUndefined = {
        ...mockCaptable,
        issuances: undefined,
        optionGrants: undefined,
      };
      mockLoad.mockReturnValue(captableWithUndefined);

      const result = handleExportCsv({});

      expect(result.success).toBe(true);
      const csvLines = result.message.split('\n');

      // Should only have header
      expect(csvLines).toHaveLength(1);
      expect(csvLines[0]).toBe(
        'Name,Email,Type,Security Class,Quantity,Price Per Share,Date,Vested'
      );
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleExportCsv({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle file write errors', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = handleExportCsv({ output: 'captable.csv' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Permission denied');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleExportCsv({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleExportJson', () => {
    it('should export cap table to JSON format', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleExportJson({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCaptable);

      const jsonData = JSON.parse(result.message);
      expect(jsonData).toEqual(mockCaptable);
    });

    it('should export to file when output specified', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockWriteFileSync.mockImplementation(() => {}); // Mock successful write

      const result = handleExportJson({ output: 'captable.json' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Exported cap table to captable.json');
      expect(mockWriteFileSync).toHaveBeenCalledWith('captable.json', expect.any(String));
    });

    it('should format JSON prettily when pretty is true', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleExportJson({ pretty: true });

      expect(result.success).toBe(true);

      // Pretty formatted JSON should have indentation
      expect(result.message).toContain('  ');
      expect(result.message).toContain('\n');

      const jsonData = JSON.parse(result.message);
      expect(jsonData).toEqual(mockCaptable);
    });

    it('should format JSON compactly when pretty is false', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleExportJson({ pretty: false });

      expect(result.success).toBe(true);

      // Compact JSON should not have extra whitespace
      expect(result.message).not.toContain('  ');

      const jsonData = JSON.parse(result.message);
      expect(jsonData).toEqual(mockCaptable);
    });

    it('should write pretty JSON to file when both pretty and output specified', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockWriteFileSync.mockImplementation(() => {}); // Mock successful write

      const result = handleExportJson({ output: 'captable.json', pretty: true });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Exported cap table to captable.json');

      const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('  '); // Should be pretty formatted
      expect(writtenContent).toContain('\n');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleExportJson({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle file write errors', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = handleExportJson({ output: 'captable.json' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Disk full');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleExportJson({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleExportPdf', () => {
    it('should return not implemented error', () => {
      const result = handleExportPdf({});

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        '❌ PDF export is not yet implemented. Use CSV or JSON export instead.'
      );
    });

    it('should return not implemented error even with output specified', () => {
      const result = handleExportPdf({ output: 'captable.pdf' });

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        '❌ PDF export is not yet implemented. Use CSV or JSON export instead.'
      );
    });
  });
});
