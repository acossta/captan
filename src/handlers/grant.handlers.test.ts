import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  handleGrantAdd,
  handleGrantList,
  handleGrantShow,
  handleGrantUpdate,
  handleGrantDelete,
} from './grant.handlers.js';
import type { FileModel, Stakeholder, SecurityClass, OptionGrant, Vesting } from '../model.js';
import { setupFakeTimers, setupMockCleanup } from '../utils/test-utils.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  createOptionGrant: vi.fn(),
  calculateVestedOptions: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock('../identifier-resolver.js', () => ({
  resolveStakeholder: vi.fn(),
  formatStakeholderReference: vi.fn(),
}));

vi.mock('../utils/date-utils.js', () => ({
  getCurrentDate: vi.fn(() => '2024-01-01'),
  getCurrentTimestamp: vi.fn(() => '2024-01-01T00:00:00.000Z'),
}));

// Import mocked modules
import { load, save } from '../store.js';
import * as helpers from '../services/helpers.js';
import { resolveStakeholder, formatStakeholderReference } from '../identifier-resolver.js';

const mockLoad = load as Mock;
const mockSave = save as Mock;
const mockCreateOptionGrant = helpers.createOptionGrant as Mock;
const mockCalculateVestedOptions = helpers.calculateVestedOptions as Mock;
const mockLogAction = helpers.logAction as Mock;
const mockResolveStakeholder = resolveStakeholder as Mock;
const mockFormatStakeholderReference = formatStakeholderReference as Mock;

describe('Grant Handlers', () => {
  // Set up test utilities
  setupMockCleanup();

  const mockStakeholder: Stakeholder = {
    id: 'sh_employee',
    name: 'Employee',
    email: 'employee@test.com',
    type: 'person',
  };

  const mockOptionPool: SecurityClass = {
    id: 'sc_option_pool',
    kind: 'OPTION_POOL',
    label: 'Employee Option Pool',
    authorized: 2000000,
  };

  const mockVesting: Vesting = {
    start: '2024-01-01',
    monthsTotal: 48,
    cliffMonths: 12,
  };

  const mockGrant: OptionGrant = {
    id: 'og_employee',
    stakeholderId: 'sh_employee',
    qty: 100000,
    exercise: 0.1,
    grantDate: '2024-01-01',
    vesting: mockVesting,
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
    stakeholders: [mockStakeholder],
    securityClasses: [mockOptionPool],
    issuances: [],
    optionGrants: [mockGrant],
    safes: [],
    valuations: [],
    audit: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleGrantAdd', () => {
    it('should successfully add a new option grant with vesting', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockCreateOptionGrant.mockReturnValue({
        id: 'og_new',
        stakeholderId: 'sh_employee',
        qty: 50000,
        exercise: 0.25,
        grantDate: '2024-02-01',
        vesting: {
          start: '2024-02-01',
          monthsTotal: 48,
          cliffMonths: 12,
        },
      });
      mockFormatStakeholderReference.mockReturnValue('Employee (sh_employee, employee@test.com)');

      const result = handleGrantAdd({
        stakeholder: 'employee@test.com',
        qty: '50000',
        exercise: '0.25',
        pool: 'sc_option_pool',
        date: '2024-02-01',
        vestingMonths: '48',
        cliffMonths: '12',
        vestingStart: '2024-02-01',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Granted 50,000 options to Employee');
      expect(result.message).toContain('$0.25/share');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('employee@test.com');
      expect(mockCreateOptionGrant).toHaveBeenCalledWith(
        'sh_employee',
        'sc_option_pool',
        50000,
        0.25,
        '2024-02-01',
        {
          start: '2024-02-01',
          monthsTotal: 48,
          cliffMonths: 12,
        }
      );
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should add grant without vesting when noVesting is true', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockCreateOptionGrant.mockReturnValue({
        id: 'og_new',
        stakeholderId: 'sh_employee',
        qty: 50000,
        exercise: 0.25,
        grantDate: '2024-02-01',
      });
      mockFormatStakeholderReference.mockReturnValue('Employee (sh_employee)');

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
        noVesting: true,
      });

      expect(result.success).toBe(true);
      expect(mockCreateOptionGrant).toHaveBeenCalledWith(
        'sh_employee',
        'sc_option_pool',
        50000,
        0.25,
        expect.any(String),
        undefined
      );
    });

    it('should use default vesting parameters when not provided', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockCreateOptionGrant.mockReturnValue(mockGrant);
      mockFormatStakeholderReference.mockReturnValue('Employee (sh_employee)');

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
      });

      expect(result.success).toBe(true);
      expect(mockCreateOptionGrant).toHaveBeenCalledWith(
        'sh_employee',
        'sc_option_pool',
        50000,
        0.25,
        expect.any(String),
        {
          start: expect.any(String),
          monthsTotal: 48,
          cliffMonths: 12,
        }
      );
    });

    it('should use current date when date not provided', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockCreateOptionGrant.mockReturnValue(mockGrant);
      mockFormatStakeholderReference.mockReturnValue('Employee (sh_employee)');

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
      });

      expect(result.success).toBe(true);
      expect(mockCreateOptionGrant).toHaveBeenCalledWith(
        'sh_employee',
        'sc_option_pool',
        50000,
        0.25,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.any(Object)
      );
    });

    it('should fail when stakeholder not found', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleGrantAdd({
        stakeholder: 'nonexistent@test.com',
        qty: '50000',
        exercise: '0.25',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when specified option pool not found', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
        pool: 'sc_nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Option pool not found: sc_nonexistent');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no option pool exists', () => {
      const captableWithoutPool = {
        ...mockCaptable,
        securityClasses: [],
      };
      mockLoad.mockReturnValue(captableWithoutPool);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No option pool found');
      expect(result.message).toContain('Create one with "captan security add --kind OPTION_POOL"');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when insufficient options in pool', () => {
      const captableWithFullPool = {
        ...mockCaptable,
        optionGrants: [
          {
            id: 'og_existing',
            stakeholderId: 'sh_other',
            qty: 1950000, // Almost all of 2M pool used
            exercise: 0.1,
            grantDate: '2024-01-01',
          },
        ],
      };
      mockLoad.mockReturnValue(captableWithFullPool);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '100000', // Would exceed available 50k
        exercise: '0.25',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Insufficient options in pool');
      expect(result.message).toContain('Available: 50,000');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleGrantAdd({
        stakeholder: 'sh_employee',
        qty: '50000',
        exercise: '0.25',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleGrantList', () => {
    it('should list all grants in table format', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000); // 25% vested

      const result = handleGrantList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🎯 Option Grants');
      expect(result.message).toContain('og_employee');
      expect(result.message).toContain('Employee');
      expect(result.message).toContain('100,000');
      expect(result.message).toContain('$0.1');
      expect(result.message).toContain('25,000');
      expect(mockCalculateVestedOptions).toHaveBeenCalledWith(mockGrant, expect.any(String));
    });

    it('should list grants without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const captableWithoutVesting = {
        ...mockCaptable,
        optionGrants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(captableWithoutVesting);

      const result = handleGrantList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🎯 Option Grants');
      expect(result.message).toContain('100,000'); // Shows full quantity as vested
      expect(mockCalculateVestedOptions).not.toHaveBeenCalled();
    });

    it('should filter grants by stakeholder', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockCalculateVestedOptions.mockReturnValue(25000);

      const result = handleGrantList({ stakeholder: 'employee@test.com' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('🎯 Option Grants');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('employee@test.com');
    });

    it('should fail when filtering by nonexistent stakeholder', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleGrantList({ stakeholder: 'nonexistent@test.com' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
    });

    it('should return JSON format when requested', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantList({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData.length).toBeGreaterThan(0);
      expect(jsonData.some((grant: any) => grant.id === 'og_employee')).toBe(true);
    });

    it('should handle empty grants list', () => {
      const emptyCaptable = { ...mockCaptable, optionGrants: [] };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleGrantList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No option grants found');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleGrantList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleGrantList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });

  describe('handleGrantShow', () => {
    it('should show grant details with vesting schedule', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000);

      const result = handleGrantShow('og_employee', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🎯 Option Grant Details');
      expect(result.message).toContain('og_employee');
      expect(result.message).toContain('2024-01-01');
      expect(result.message).toContain('Employee (sh_employee)');
      expect(result.message).toContain('100,000 options');
      expect(result.message).toContain('$0.1');
      expect(result.message).toContain('📅 Vesting Schedule');
      expect(result.message).toContain('Start Date:    2024-01-01');
      expect(result.message).toContain('Total Period:  48 months');
      expect(result.message).toContain('Cliff:         12 months');
      expect(result.message).toContain('Vested:        25,000 options (25.0%)');
      expect(result.message).toContain('Unvested:      75,000 options');
      expect(result.message).toContain('Fully Vested:  2028-01-01');
      expect(mockCalculateVestedOptions).toHaveBeenCalledWith(mockGrant, expect.any(String));
    });

    it('should show grant details without vesting schedule', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const captableWithoutVesting = {
        ...mockCaptable,
        optionGrants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(captableWithoutVesting);

      const result = handleGrantShow('og_employee', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('🎯 Option Grant Details');
      expect(result.message).toContain('Vesting:         Fully vested (no vesting schedule)');
      expect(result.message).not.toContain('📅 Vesting Schedule');
      expect(mockCalculateVestedOptions).not.toHaveBeenCalled();
    });

    it('should fail when no grant ID provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantShow(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a grant ID');
    });

    it('should fail when grant not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantShow('og_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Grant not found: og_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleGrantShow('og_employee', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });
  });

  describe('handleGrantUpdate', () => {
    it('should update grant vesting start date', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantUpdate('og_employee', {
        vestingStart: '2024-02-01',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated grant og_employee');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should update grant exercise price', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantUpdate('og_employee', {
        exercise: '0.50',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated grant og_employee');
    });

    it('should update both vesting start and exercise price', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantUpdate('og_employee', {
        vestingStart: '2024-02-01',
        exercise: '0.50',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated grant og_employee');
    });

    it('should not update vesting start for grant without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const captableWithoutVesting = {
        ...mockCaptable,
        optionGrants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(captableWithoutVesting);

      const result = handleGrantUpdate('og_employee', {
        vestingStart: '2024-02-01',
        exercise: '0.50',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated grant og_employee');
      // Should only update exercise price, not vesting start
    });

    it('should fail when no grant ID provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantUpdate(undefined, { exercise: '0.50' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a grant ID');
    });

    it('should fail when no updates provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantUpdate('og_employee', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No updates provided');
      expect(result.message).toContain('Use --vesting-start or --exercise to update');
    });

    it('should fail when grant not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantUpdate('og_nonexistent', { exercise: '0.50' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Grant not found: og_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleGrantUpdate('og_employee', { exercise: '0.50' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });
  });

  describe('handleGrantDelete', () => {
    it('should delete grant without vesting', () => {
      const grantWithoutVesting = { ...mockGrant, vesting: undefined };
      const captableWithoutVesting = {
        ...mockCaptable,
        optionGrants: [grantWithoutVesting],
      };
      mockLoad.mockReturnValue(captableWithoutVesting);

      const result = handleGrantDelete('og_employee', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted grant og_employee');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should delete grant with vesting but no vested options', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(0); // No vested options

      const result = handleGrantDelete('og_employee', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted grant og_employee');
      expect(mockCalculateVestedOptions).toHaveBeenCalledWith(mockGrant, expect.any(String));
    });

    it('should force delete grant with vested options', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000); // Has vested options

      const result = handleGrantDelete('og_employee', { force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted grant og_employee');
      expect(mockSave).toHaveBeenCalled();
    });

    it('should fail to delete grant with vested options without force', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockCalculateVestedOptions.mockReturnValue(25000); // Has vested options

      const result = handleGrantDelete('og_employee', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Grant has 25,000 vested options');
      expect(result.message).toContain('Use --force to delete anyway');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no grant ID provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantDelete(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a grant ID');
    });

    it('should fail when grant not found', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleGrantDelete('og_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Grant not found: og_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleGrantDelete('og_employee', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleGrantDelete('og_employee', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });
});
