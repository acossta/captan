import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  handleReportSummary,
  handleReportOwnership,
  handleReportStakeholder,
  handleReportSecurity,
} from './report.handlers.js';
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
vi.mock('../store.js', () => ({
  load: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  getStakeholderHoldings: vi.fn(),
  calculateVestedOptions: vi.fn(),
}));

vi.mock('../identifier-resolver.js', () => ({
  resolveStakeholder: vi.fn(),
}));

// Import mocked modules
import { load } from '../store.js';
import * as helpers from '../services/helpers.js';
import { resolveStakeholder } from '../identifier-resolver.js';

const mockLoad = load as Mock;
const mockGetStakeholderHoldings = helpers.getStakeholderHoldings as Mock;
const mockCalculateVestedOptions = helpers.calculateVestedOptions as Mock;
const mockResolveStakeholder = resolveStakeholder as Mock;

describe('Report Handlers', () => {
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
    parValue: 0.001,
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

  const mockSafe: SAFE = {
    id: 'safe_investor',
    stakeholderId: 'sh_investor',
    amount: 500000,
    cap: 10000000,
    type: 'pre',
    date: '2024-01-01',
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
    safes: [mockSafe],
    valuations: [],
    audit: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleReportSummary', () => {
    it('should generate summary report in table format', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleReportSummary({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Cap Table Summary');
      expect(result.message).toContain('Company: Test Company');
      expect(result.message).toContain('Type: C_CORP');
      expect(result.message).toContain('State: DE');
      expect(result.message).toContain('Formed: 2024-01-01');
      expect(result.message).toContain('📈 Statistics:');
      expect(result.message).toContain('Stakeholders: 2');
      expect(result.message).toContain('Security Classes: 2');
      expect(result.message).toContain('Share Issuances: 1');
      expect(result.message).toContain('Option Grants: 1');
      expect(result.message).toContain('SAFEs: 1');
      expect(result.message).toContain('💰 Totals:');
      expect(result.message).toContain('Issued Shares: 8,000,000');
      expect(result.message).toContain('Granted Options: 100,000');
      expect(result.message).toContain('SAFE Investment: $500,000');
    });

    it('should generate summary report in JSON format', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleReportSummary({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData).toEqual({
        company: mockCaptable.company,
        stakeholders: 2,
        securityClasses: 2,
        issuances: 1,
        grants: 1,
        safes: 1,
        totalShares: 8000000,
        totalOptions: 100000,
        totalSafes: 500000,
      });
    });

    it('should handle missing jurisdiction', () => {
      const captableWithoutJurisdiction = {
        ...mockCaptable,
        company: { ...mockCaptable.company, jurisdiction: undefined },
      };
      mockLoad.mockReturnValue(captableWithoutJurisdiction);

      const result = handleReportSummary({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('State: Not specified');
    });

    it('should handle empty arrays', () => {
      const emptyCaptable = {
        ...mockCaptable,
        issuances: [],
        optionGrants: [],
        safes: [],
      };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleReportSummary({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Share Issuances: 0');
      expect(result.message).toContain('Option Grants: 0');
      expect(result.message).toContain('SAFEs: 0');
      expect(result.message).toContain('Issued Shares: 0');
      expect(result.message).toContain('Granted Options: 0');
      expect(result.message).toContain('SAFE Investment: $0');
    });

    it('should handle undefined arrays', () => {
      const captableWithUndefined = {
        ...mockCaptable,
        issuances: undefined,
        optionGrants: undefined,
        safes: undefined,
      };
      mockLoad.mockReturnValue(captableWithUndefined);

      const result = handleReportSummary({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Share Issuances: 0');
      expect(result.message).toContain('Option Grants: 0');
      expect(result.message).toContain('SAFEs: 0');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleReportSummary({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleReportSummary({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleReportOwnership', () => {
    it('should generate ownership report in table format', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000); // 25% vested

      const result = handleReportOwnership({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Ownership Table');
      expect(result.message).toContain('Name');
      expect(result.message).toContain('Shares');
      expect(result.message).toContain('Options');
      expect(result.message).toContain('Outstanding');
      expect(result.message).toContain('Founder');
      expect(result.message).toContain('8,000,000');
      expect(result.message).toContain('Employee');
      expect(result.message).toContain('25,000');
      expect(result.message).toContain('8,025,000'); // Total outstanding
      expect(result.message).toContain('99.69%'); // Founder percentage
      expect(result.message).toContain('0.31%'); // Employee percentage
      expect(result.message).toContain('Total');
      expect(result.message).toContain('100.00%');
      expect(mockCalculateVestedOptions).toHaveBeenCalledWith(mockGrant, expect.any(String));
    });

    it('should generate ownership report in JSON format', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000);

      const result = handleReportOwnership({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData).toHaveLength(2);
      expect(jsonData[0]).toMatchObject({
        stakeholder: mockStakeholder,
        shares: 8000000,
        vestedOptions: 0,
        outstanding: 8000000,
      });
      expect(jsonData[1]).toMatchObject({
        stakeholder: mockEmployee,
        shares: 0,
        vestedOptions: 25000,
        outstanding: 25000,
      });
    });

    it('should use specified date for vesting calculations', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(50000); // More vested at later date

      const result = handleReportOwnership({ date: '2025-01-01' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Ownership Table (as of 2025-01-01)');
      expect(mockCalculateVestedOptions).toHaveBeenCalledWith(mockGrant, '2025-01-01');
    });

    it('should handle grants without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const captableWithoutVesting = {
        ...mockCaptable,
        optionGrants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(captableWithoutVesting);

      const result = handleReportOwnership({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('100,000'); // Full quantity is vested
      expect(mockCalculateVestedOptions).not.toHaveBeenCalled();
    });

    it('should filter out stakeholders with no outstanding shares', () => {
      const captableWithoutGrants = {
        ...mockCaptable,
        optionGrants: [],
      };
      mockLoad.mockReturnValue(captableWithoutGrants);

      const result = handleReportOwnership({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Founder');
      expect(result.message).not.toContain('Employee'); // No outstanding shares
    });

    it('should handle empty captable', () => {
      const emptyCaptable = {
        ...mockCaptable,
        stakeholders: [],
        issuances: [],
        optionGrants: [],
      };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleReportOwnership({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Ownership Table');
      expect(result.message).toContain('Total');
      expect(result.message).toContain('0'); // Zero outstanding
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleReportOwnership({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleReportOwnership({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });

  describe('handleReportStakeholder', () => {
    const mockHoldings = {
      stakeholder: mockStakeholder,
      issuances: [mockIssuance],
      grants: [mockGrant],
      safes: [mockSafe],
    };

    it('should generate stakeholder report with all holdings', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue(mockHoldings);
      mockCalculateVestedOptions.mockReturnValue(25000);

      const result = handleReportStakeholder('founder@test.com', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📋 Stakeholder Report: Founder');
      expect(result.message).toContain('ID: sh_founder');
      expect(result.message).toContain('Email: founder@test.com');
      expect(result.message).toContain('Type: PERSON');
      expect(result.message).toContain('📊 Share Issuances (1)');
      expect(result.message).toContain('8,000,000 Common Stock');
      expect(result.message).toContain('at $0.001/share');
      expect(result.message).toContain('Total: 8,000,000 shares');
      expect(result.message).toContain('🎯 Option Grants (1)');
      expect(result.message).toContain('100,000 options at $0.1');
      expect(result.message).toContain('(25,000 vested)');
      expect(result.message).toContain('Total: 100,000 granted, 25,000 vested');
      expect(result.message).toContain('💰 SAFE Investments (1)');
      expect(result.message).toContain('$500,000');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('founder@test.com');
      expect(mockGetStakeholderHoldings).toHaveBeenCalledWith(mockCaptable, 'sh_founder');
    });

    it('should handle stakeholder without email', () => {
      const stakeholderWithoutEmail = { ...mockStakeholder, email: undefined };
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: stakeholderWithoutEmail,
      });
      mockGetStakeholderHoldings.mockReturnValue({
        ...mockHoldings,
        stakeholder: stakeholderWithoutEmail,
      });

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📋 Stakeholder Report: Founder');
      expect(result.message).not.toContain('Email:');
    });

    it('should handle entity type stakeholder', () => {
      const entityStakeholder = { ...mockStakeholder, type: 'entity' as const };
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: entityStakeholder });
      mockGetStakeholderHoldings.mockReturnValue({
        ...mockHoldings,
        stakeholder: entityStakeholder,
      });

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Type: ENTITY');
    });

    it('should handle issuance without price per share', () => {
      const issuanceWithoutPrice = { ...mockIssuance, pps: undefined };
      const holdingsWithoutPrice = {
        stakeholder: mockStakeholder,
        issuances: [issuanceWithoutPrice],
        grants: [], // Remove grants to avoid "at $" from exercise price
        safes: [], // Remove safes to avoid "at $" from amounts
      };
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue(holdingsWithoutPrice);

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('8,000,000 Common Stock');
      expect(result.message).not.toContain('at $');
    });

    it('should handle grants without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const holdingsWithoutVesting = {
        ...mockHoldings,
        grants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue(holdingsWithoutVesting);

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('100,000 options at $0.1');
      expect(result.message).not.toContain('vested)');
      expect(mockCalculateVestedOptions).not.toHaveBeenCalled();
    });

    it('should handle SAFE with terms', () => {
      const safeWithTerms = { ...mockSafe, cap: 10000000, discount: 0.2 };
      const holdingsWithTerms = {
        ...mockHoldings,
        safes: [safeWithTerms],
      };
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue(holdingsWithTerms);

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('$500,000 ($10,000,000 cap, 20% discount)');
    });

    it('should handle stakeholder with no holdings', () => {
      const emptyHoldings = {
        stakeholder: mockStakeholder,
        issuances: [],
        grants: [],
        safes: [],
      };
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue(emptyHoldings);

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No equity holdings found');
    });

    it('should fail when no stakeholder ID provided', () => {
      const result = handleReportStakeholder(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a stakeholder ID or email');
    });

    it('should fail when stakeholder not found', () => {
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleReportStakeholder('nonexistent@test.com', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
    });

    it('should fail when captable does not exist', () => {
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockLoad.mockReturnValue(null);

      const result = handleReportStakeholder('sh_founder', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });
  });

  describe('handleReportSecurity', () => {
    it('should generate regular security class report', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleReportSecurity('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🏦 Security Class Report: Common Stock');
      expect(result.message).toContain('ID: sc_common');
      expect(result.message).toContain('Type: COMMON');
      expect(result.message).toContain('Authorized: 10,000,000');
      expect(result.message).toContain('Par Value: $0.001');
      expect(result.message).toContain('📊 Share Utilization:');
      expect(result.message).toContain('Issued: 8,000,000');
      expect(result.message).toContain('Remaining: 2,000,000');
      expect(result.message).toContain('Utilization: 80.0%');
      expect(result.message).toContain('📈 Issuances (1)');
      expect(result.message).toContain('Founder: 8,000,000 at $0.001/share');
    });

    it('should generate option pool report', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleReportSecurity('sc_option_pool', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🏦 Security Class Report: Employee Option Pool');
      expect(result.message).toContain('Type: OPTION_POOL');
      expect(result.message).toContain('📊 Pool Utilization:');
      expect(result.message).toContain('Granted: 100,000');
      expect(result.message).toContain('Remaining: 1,900,000');
      expect(result.message).toContain('Utilization: 5.0%');
      expect(result.message).toContain('🎯 Grants (1)');
      expect(result.message).toContain('Employee: 100,000 at $0.1');
    });

    it('should handle security without par value', () => {
      const securityWithoutPar = { ...mockCommonStock };
      delete securityWithoutPar.parValue;
      const captableWithoutPar = {
        ...mockCaptable,
        securityClasses: [securityWithoutPar, mockOptionPool],
      };
      mockLoad.mockReturnValue(captableWithoutPar);

      const result = handleReportSecurity('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('Par Value:');
    });

    it('should handle security with no issuances', () => {
      const captableWithoutIssuances = {
        ...mockCaptable,
        issuances: [],
      };
      mockLoad.mockReturnValue(captableWithoutIssuances);

      const result = handleReportSecurity('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Issued: 0');
      expect(result.message).toContain('Remaining: 10,000,000');
      expect(result.message).toContain('Utilization: 0.0%');
      expect(result.message).not.toContain('📈 Issuances');
    });

    it('should handle option pool with no grants', () => {
      const captableWithoutGrants = {
        ...mockCaptable,
        optionGrants: [],
      };
      mockLoad.mockReturnValue(captableWithoutGrants);

      const result = handleReportSecurity('sc_option_pool', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Granted: 0');
      expect(result.message).toContain('Remaining: 2,000,000');
      expect(result.message).toContain('Utilization: 0.0%');
      expect(result.message).not.toContain('🎯 Grants');
    });

    it('should handle issuance without price per share', () => {
      const issuanceWithoutPrice = { ...mockIssuance, pps: undefined };
      const captableWithoutPrice = {
        ...mockCaptable,
        issuances: [issuanceWithoutPrice],
      };
      mockLoad.mockReturnValue(captableWithoutPrice);

      const result = handleReportSecurity('sc_common', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Founder: 8,000,000');
      expect(result.message).not.toContain('at $');
    });

    it('should fail when no security ID provided', () => {
      const result = handleReportSecurity(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a security class ID');
    });

    it('should fail when security class not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleReportSecurity('sc_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Security class not found: sc_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleReportSecurity('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleReportSecurity('sc_common', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });
});
