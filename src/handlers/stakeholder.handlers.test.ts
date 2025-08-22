import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  handleStakeholderAdd,
  handleStakeholderList,
  handleStakeholderShow,
  handleStakeholderUpdate,
  handleStakeholderDelete,
} from './stakeholder.handlers.js';
import type { FileModel, Stakeholder } from '../model.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  createStakeholder: vi.fn(),
  logAction: vi.fn(),
  formatTable: vi.fn(),
  getStakeholderHoldings: vi.fn(),
  hasStakeholderHoldings: vi.fn(),
}));

vi.mock('../identifier-resolver.js', () => ({
  resolveStakeholder: vi.fn(),
  formatStakeholderReference: vi.fn(),
  suggestSimilarStakeholders: vi.fn(),
}));

// Import mocked modules
import { load, save } from '../store.js';
import * as helpers from '../services/helpers.js';
import {
  resolveStakeholder,
  formatStakeholderReference,
  suggestSimilarStakeholders,
} from '../identifier-resolver.js';

const mockLoad = load as Mock;
const mockSave = save as Mock;
const mockCreateStakeholder = helpers.createStakeholder as Mock;
const mockLogAction = helpers.logAction as Mock;
const mockFormatTable = helpers.formatTable as Mock;
const mockGetStakeholderHoldings = helpers.getStakeholderHoldings as Mock;
const mockHasStakeholderHoldings = helpers.hasStakeholderHoldings as Mock;
const mockResolveStakeholder = resolveStakeholder as Mock;
const mockFormatStakeholderReference = formatStakeholderReference as Mock;
const mockSuggestSimilarStakeholders = suggestSimilarStakeholders as Mock;

describe('Stakeholder Handlers', () => {
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
        id: 'sh_existing',
        name: 'Existing User',
        email: 'existing@test.com',
        type: 'person',
      },
    ],
    securityClasses: [],
    issuances: [],
    optionGrants: [],
    safes: [],
    valuations: [],
    audit: [],
  };

  const mockStakeholder: Stakeholder = {
    id: 'sh_existing',
    name: 'Existing User',
    email: 'existing@test.com',
    type: 'person',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleStakeholderAdd', () => {
    it('should successfully add a new stakeholder', () => {
      const newStakeholder = {
        id: 'sh_new',
        name: 'New User',
        email: 'new@test.com',
        type: 'person' as const,
      };
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockCreateStakeholder.mockReturnValue(newStakeholder);
      mockFormatStakeholderReference.mockReturnValue('New User (sh_new, new@test.com)');

      const result = handleStakeholderAdd({
        name: 'New User',
        email: 'new@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Added stakeholder New User');
      expect(result.message).toContain('sh_new');
      expect(result.message).toContain('new@test.com');
      expect(mockCreateStakeholder).toHaveBeenCalledWith('New User', 'new@test.com', 'PERSON');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should add stakeholder without email', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockCreateStakeholder.mockReturnValue({ ...mockStakeholder, email: '' });

      const result = handleStakeholderAdd({
        name: 'No Email User',
      });

      expect(result.success).toBe(true);
      expect(mockCreateStakeholder).toHaveBeenCalledWith('No Email User', '', 'PERSON');
    });

    it('should create entity type stakeholder', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockCreateStakeholder.mockReturnValue({ ...mockStakeholder, type: 'entity' });

      const result = handleStakeholderAdd({
        name: 'Test Corp',
        email: 'contact@testcorp.com',
        entity: 'ENTITY',
      });

      expect(result.success).toBe(true);
      expect(mockCreateStakeholder).toHaveBeenCalledWith(
        'Test Corp',
        'contact@testcorp.com',
        'ENTITY'
      );
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleStakeholderAdd({
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when email already exists', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));

      const result = handleStakeholderAdd({
        name: 'Duplicate User',
        email: 'existing@test.com', // This email already exists in mockCaptable
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        '❌ Stakeholder with email existing@test.com already exists'
      );
      expect(result.message).toContain('sh_existing');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleStakeholderAdd({
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleStakeholderList', () => {
    it('should list stakeholders in table format by default', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleStakeholderList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📋 Stakeholders');
      expect(result.message).toContain('sh_existing');
      expect(result.message).toContain('Existing User');
      expect(result.message).toContain('existing@test.com');
      expect(result.message).toContain('PERSON');
    });

    it('should return JSON format when requested', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleStakeholderList({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData.length).toBeGreaterThan(0);
      expect(jsonData.some((sh: any) => sh.id === 'sh_existing')).toBe(true);
    });

    it('should handle empty stakeholder list', () => {
      const emptyCaptable = { ...mockCaptable, stakeholders: [] };
      mockLoad.mockReturnValue(emptyCaptable);
      mockFormatTable.mockReturnValue('📋 Stakeholders\n\nNo stakeholders found.');

      const result = handleStakeholderList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No stakeholders found');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleStakeholderList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = handleStakeholderList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File read error');
    });
  });

  describe('handleStakeholderShow', () => {
    it('should show stakeholder details by ID', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue({
        stakeholder: mockStakeholder,
        issuances: [],
        grants: [],
        safes: [],
      });

      const result = handleStakeholderShow('sh_existing', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('👤 Stakeholder Details');
      expect(result.message).toContain('Name:');
      expect(result.message).toContain('ID:');
      expect(result.message).toContain('sh_existing');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('sh_existing');
    });

    it('should show stakeholder details by email', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockGetStakeholderHoldings.mockReturnValue({
        stakeholder: mockStakeholder,
        issuances: [],
        grants: [],
        safes: [],
      });

      const result = handleStakeholderShow('existing@test.com', {});

      expect(result.success).toBe(true);
      expect(mockResolveStakeholder).toHaveBeenCalledWith('existing@test.com');
    });

    it('should prompt for stakeholder when none provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleStakeholderShow(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Please provide a stakeholder');
    });

    it('should handle stakeholder not found', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with ID: nonexistent',
      });
      mockSuggestSimilarStakeholders.mockReturnValue([]);

      const result = handleStakeholderShow('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No stakeholder found');
      expect(mockSuggestSimilarStakeholders).toHaveBeenCalled();
    });

    it('should suggest similar stakeholders when not found', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found',
      });
      mockSuggestSimilarStakeholders.mockReturnValue([mockStakeholder]);
      mockFormatStakeholderReference.mockReturnValue(
        'Existing User (sh_existing, existing@test.com)'
      );

      const result = handleStakeholderShow('existing@test.co', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Did you mean');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No captable.json found',
      });
      mockSuggestSimilarStakeholders.mockReturnValue([]);

      const result = handleStakeholderShow('test', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No captable.json found');
    });
  });

  describe('handleStakeholderUpdate', () => {
    it('should update stakeholder name', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockFormatStakeholderReference.mockReturnValue(
        'Updated Name (sh_existing, existing@test.com)'
      );

      const result = handleStakeholderUpdate('sh_existing', {
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated stakeholder');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should update stakeholder email', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockFormatStakeholderReference.mockReturnValue(
        'Existing User (sh_existing, updated@test.com)'
      );

      const result = handleStakeholderUpdate('sh_existing', {
        email: 'updated@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated stakeholder');
    });

    it('should update both name and email', () => {
      const captableWithStakeholder = JSON.parse(JSON.stringify(mockCaptable));
      mockLoad.mockReturnValue(captableWithStakeholder);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockFormatStakeholderReference.mockReturnValue('New Name (sh_existing, new@test.com)');

      const result = handleStakeholderUpdate('sh_existing', {
        name: 'New Name',
        email: 'new@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated stakeholder');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should fail when no stakeholder provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleStakeholderUpdate(undefined, { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Please provide a stakeholder');
    });

    it('should fail when no updates provided', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });

      const result = handleStakeholderUpdate('sh_existing', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No updates provided');
    });

    it('should fail when stakeholder not found', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: false, error: 'No stakeholder found' });

      const result = handleStakeholderUpdate('nonexistent', { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No stakeholder found');
    });

    it('should fail when email conflicts with existing stakeholder', () => {
      const captableWithTwo = {
        ...mockCaptable,
        stakeholders: [
          ...mockCaptable.stakeholders,
          {
            id: 'sh_other',
            name: 'Other User',
            email: 'other@test.com',
            type: 'person' as const,
          },
        ],
      };
      mockLoad.mockReturnValue(captableWithTwo);
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: captableWithTwo.stakeholders[0],
      });

      const result = handleStakeholderUpdate('sh_existing', {
        email: 'other@test.com', // This email already exists for another stakeholder
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Email other@test.com is already used');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });
      mockResolveStakeholder.mockReturnValue({ success: false, error: 'No captable.json found' });

      const result = handleStakeholderUpdate('test', { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });
  });

  describe('handleStakeholderDelete', () => {
    it('should delete stakeholder without holdings', () => {
      mockLoad.mockReturnValue(JSON.parse(JSON.stringify(mockCaptable)));
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockHasStakeholderHoldings.mockReturnValue(false);

      const result = handleStakeholderDelete('sh_existing', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted stakeholder');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should force delete stakeholder with holdings', () => {
      const captableWithHoldings = {
        ...JSON.parse(JSON.stringify(mockCaptable)),
        issuances: [
          {
            id: 'is_test',
            stakeholderId: 'sh_existing',
            securityClassId: 'sc_common',
            qty: 1000000,
            date: '2024-01-01',
          },
        ],
      };
      mockLoad.mockReturnValue(captableWithHoldings);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });
      mockHasStakeholderHoldings.mockReturnValue(true);
      mockFormatStakeholderReference.mockReturnValue(
        'Existing User (sh_existing, existing@test.com)'
      );

      const result = handleStakeholderDelete('sh_existing', { force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted stakeholder');
    });

    it('should fail to delete stakeholder with holdings without force', () => {
      const captableWithHoldings = {
        ...mockCaptable,
        issuances: [
          {
            id: 'is_test',
            stakeholderId: 'sh_existing',
            securityClassId: 'sc_common',
            qty: 1000000,
            date: '2024-01-01',
          },
        ],
      };
      mockLoad.mockReturnValue(captableWithHoldings);
      mockResolveStakeholder.mockReturnValue({ success: true, stakeholder: mockStakeholder });

      const result = handleStakeholderDelete('sh_existing', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Stakeholder has existing holdings');
      expect(result.message).toContain('Use --force to delete anyway');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no stakeholder provided', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleStakeholderDelete(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Please provide a stakeholder');
    });

    it('should fail when stakeholder not found', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockReturnValue({ success: false, error: 'No stakeholder found' });

      const result = handleStakeholderDelete('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No stakeholder found');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });
      mockResolveStakeholder.mockReturnValue({ success: false, error: 'No captable.json found' });

      const result = handleStakeholderDelete('test', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockResolveStakeholder.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleStakeholderDelete('test', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });
});
