import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  handleIssuanceAdd,
  handleIssuanceList,
  handleIssuanceShow,
  handleIssuanceUpdate,
  handleIssuanceDelete,
} from './issuance.handlers.js';
import type { FileModel, Stakeholder, SecurityClass, Issuance } from '../model.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  createIssuance: vi.fn(),
  getIssuedShares: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock('../identifier-resolver.js', () => ({
  resolveStakeholder: vi.fn(),
  formatStakeholderReference: vi.fn(),
}));

// Import mocked modules
import { load, save } from '../store.js';
import * as helpers from '../services/helpers.js';
import { resolveStakeholder, formatStakeholderReference } from '../identifier-resolver.js';

const mockLoad = load as Mock;
const mockSave = save as Mock;
const mockCreateIssuance = helpers.createIssuance as Mock;
const mockGetIssuedShares = helpers.getIssuedShares as Mock;
const mockLogAction = helpers.logAction as Mock;
const mockResolveStakeholder = resolveStakeholder as Mock;
const mockFormatStakeholderReference = formatStakeholderReference as Mock;

describe('Issuance Handlers', () => {
  const createMockStakeholder = (): Stakeholder => ({
    id: 'sh_founder',
    name: 'Founder',
    email: 'founder@test.com',
    type: 'person',
  });

  const createMockSecurityClass = (): SecurityClass => ({
    id: 'sc_common',
    kind: 'COMMON',
    label: 'Common Stock',
    authorized: 10000000,
    parValue: 0.001,
  });

  const createMockIssuance = (): Issuance => ({
    id: 'is_founder',
    stakeholderId: 'sh_founder',
    securityClassId: 'sc_common',
    qty: 8000000,
    pps: 0.001,
    date: '2024-01-01',
  });

  const createMockCaptable = (): FileModel => ({
    version: 2,
    company: {
      id: 'comp_test',
      name: 'Test Company',
      formationDate: '2024-01-01',
      entityType: 'C_CORP',
      jurisdiction: 'DE',
      currency: 'USD',
    },
    stakeholders: [createMockStakeholder()],
    securityClasses: [createMockSecurityClass()],
    issuances: [createMockIssuance()],
    optionGrants: [],
    safes: [],
    valuations: [],
    audit: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleIssuanceAdd', () => {
    it('should successfully add a new issuance', () => {
      const captable = createMockCaptable();
      mockLoad.mockReturnValue(captable);
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockGetIssuedShares.mockReturnValue(8000000);
      mockCreateIssuance.mockReturnValue({
        id: 'is_new',
        stakeholderId: 'sh_founder',
        securityClassId: 'sc_common',
        qty: 1000000,
        pps: 0.1,
        date: '2024-01-15',
      });
      mockFormatStakeholderReference.mockReturnValue('Founder (sh_founder, founder@test.com)');

      const result = handleIssuanceAdd({
        stakeholder: 'founder@test.com',
        security: 'sc_common',
        qty: '1000000',
        pps: '0.10',
        date: '2024-01-15',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Issued 1,000,000 shares of Common Stock');
      expect(result.message).toContain('Founder (sh_founder, founder@test.com)');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('founder@test.com');
      expect(mockGetIssuedShares).toHaveBeenCalledWith(captable, 'sc_common');
      expect(mockCreateIssuance).toHaveBeenCalledWith(
        'sh_founder',
        'sc_common',
        1000000,
        0.1,
        '2024-01-15'
      );
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should add issuance without price per share', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockGetIssuedShares.mockReturnValue(8000000);
      mockCreateIssuance.mockReturnValue(createMockIssuance());
      mockFormatStakeholderReference.mockReturnValue('Founder (sh_founder)');

      const result = handleIssuanceAdd({
        stakeholder: 'sh_founder',
        security: 'sc_common',
        qty: '1000000',
      });

      expect(result.success).toBe(true);
      expect(mockCreateIssuance).toHaveBeenCalledWith(
        'sh_founder',
        'sc_common',
        1000000,
        undefined,
        expect.any(String)
      );
    });

    it('should use current date when date not provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockGetIssuedShares.mockReturnValue(8000000);
      mockCreateIssuance.mockReturnValue(createMockIssuance());
      mockFormatStakeholderReference.mockReturnValue('Founder (sh_founder)');

      const result = handleIssuanceAdd({
        stakeholder: 'sh_founder',
        security: 'sc_common',
        qty: '1000000',
      });

      expect(result.success).toBe(true);
      expect(mockCreateIssuance).toHaveBeenCalledWith(
        'sh_founder',
        'sc_common',
        1000000,
        undefined,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });

    it('should fail when stakeholder not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleIssuanceAdd({
        stakeholder: 'nonexistent@test.com',
        security: 'sc_common',
        qty: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when security class not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });

      const result = handleIssuanceAdd({
        stakeholder: 'sh_founder',
        security: 'sc_nonexistent',
        qty: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Security class not found: sc_nonexistent');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when issuance would exceed authorized shares', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockGetIssuedShares.mockReturnValue(9500000); // Already 9.5M issued

      const result = handleIssuanceAdd({
        stakeholder: 'sh_founder',
        security: 'sc_common',
        qty: '1000000', // Would exceed 10M authorized
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Issuance would exceed authorized shares');
      expect(result.message).toContain('Available: 500,000');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleIssuanceAdd({
        stakeholder: 'sh_founder',
        security: 'sc_common',
        qty: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleIssuanceAdd({
        stakeholder: 'sh_founder',
        security: 'sc_common',
        qty: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleIssuanceList', () => {
    it('should list all issuances in table format', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Share Issuances');
      expect(result.message).toContain('is_founder');
      expect(result.message).toContain('Founder');
      expect(result.message).toContain('Common Stock');
      expect(result.message).toContain('8,000,000');
      expect(result.message).toContain('$0.001');
    });

    it('should list issuances without price per share', () => {
      const issuanceWithoutPrice = { ...createMockIssuance(), pps: undefined };
      const captableWithoutPrice = {
        ...createMockCaptable(),
        issuances: [issuanceWithoutPrice],
      };
      mockLoad.mockReturnValue(captableWithoutPrice);

      const result = handleIssuanceList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('-'); // Shows "-" for missing price
    });

    it('should filter issuances by stakeholder', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });

      const result = handleIssuanceList({ stakeholder: 'founder@test.com' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Share Issuances');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('founder@test.com');
    });

    it('should fail when filtering by nonexistent stakeholder', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleIssuanceList({ stakeholder: 'nonexistent@test.com' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
    });

    it('should return JSON format when requested', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceList({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData.length).toBeGreaterThan(0);
      expect(jsonData.some((issuance: any) => issuance.id === 'is_founder')).toBe(true);
    });

    it('should handle empty issuances list', () => {
      const emptyCaptable = { ...createMockCaptable(), issuances: [] };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleIssuanceList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No issuances found');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleIssuanceList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleIssuanceList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });

  describe('handleIssuanceShow', () => {
    it('should show issuance details with price', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceShow('is_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Issuance Details');
      expect(result.message).toContain('is_founder');
      expect(result.message).toContain('2024-01-01');
      expect(result.message).toContain('Founder (sh_founder)');
      expect(result.message).toContain('Common Stock (sc_common)');
      expect(result.message).toContain('8,000,000 shares');
      expect(result.message).toContain('$0.001');
      expect(result.message).toContain('$8,000'); // Total value calculation
    });

    it('should show issuance details without price', () => {
      const issuanceWithoutPrice = { ...createMockIssuance(), pps: undefined };
      const captableWithoutPrice = {
        ...createMockCaptable(),
        issuances: [issuanceWithoutPrice],
      };
      mockLoad.mockReturnValue(captableWithoutPrice);

      const result = handleIssuanceShow('is_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📊 Issuance Details');
      expect(result.message).not.toContain('Price/Share');
      expect(result.message).not.toContain('Total Value');
    });

    it('should show issuance details with certificate number', () => {
      const issuanceWithCert = { ...createMockIssuance(), cert: 'CERT-001' };
      const captableWithCert = {
        ...createMockCaptable(),
        issuances: [issuanceWithCert],
      };
      mockLoad.mockReturnValue(captableWithCert);

      const result = handleIssuanceShow('is_founder', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Certificate:  CERT-001');
    });

    it('should fail when no issuance ID provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceShow(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide an issuance ID');
    });

    it('should fail when issuance not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceShow('is_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Issuance not found: is_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleIssuanceShow('is_founder', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });
  });

  describe('handleIssuanceUpdate', () => {
    it('should update issuance quantity', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleIssuanceUpdate('is_founder', {
        qty: '7000000',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated issuance is_founder');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should update issuance price per share', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceUpdate('is_founder', {
        pps: '0.50',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated issuance is_founder');
    });

    it('should update both quantity and price', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleIssuanceUpdate('is_founder', {
        qty: '7000000',
        pps: '0.50',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated issuance is_founder');
    });

    it('should fail when quantity update would exceed authorized shares', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockGetIssuedShares.mockReturnValue(8000000);

      const result = handleIssuanceUpdate('is_founder', {
        qty: '12000000', // Would exceed 10M authorized
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Update would exceed authorized shares');
      expect(result.message).toContain('Available: 10,000,000'); // 10M authorized - 8M currently issued + 8M (the old qty being replaced) = 10M available
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no issuance ID provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceUpdate(undefined, { qty: '1000000' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide an issuance ID');
    });

    it('should fail when no updates provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceUpdate('is_founder', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No updates provided');
      expect(result.message).toContain('Use --qty or --pps to update');
    });

    it('should fail when issuance not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceUpdate('is_nonexistent', { qty: '1000000' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Issuance not found: is_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleIssuanceUpdate('is_founder', { qty: '1000000' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });
  });

  describe('handleIssuanceDelete', () => {
    it('should delete issuance with force flag', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceDelete('is_founder', { force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted issuance is_founder');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should fail to delete without force flag', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceDelete('is_founder', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        '❌ Deleting an issuance removes 8,000,000 shares from Founder'
      );
      expect(result.message).toContain('Use --force to confirm');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no issuance ID provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceDelete(undefined, { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide an issuance ID');
    });

    it('should fail when issuance not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleIssuanceDelete('is_nonexistent', { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Issuance not found: is_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleIssuanceDelete('is_founder', { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleIssuanceDelete('is_founder', { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });
});
