import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { handleInit, handleValidate, handleSchema, handleLog } from './system.handlers.js';
import type { FileModel, SecurityClass, Stakeholder, Issuance } from '../model.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
  save: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  createSecurityClass: vi.fn(),
  createStakeholder: vi.fn(),
  createIssuance: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock('../init-wizard.js', () => ({
  runInitWizard: vi.fn(),
  buildModelFromWizard: vi.fn(),
}));

vi.mock('../schema.js', () => ({
  validateCaptable: vi.fn(),
  validateCaptableExtended: vi.fn(),
}));

vi.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
}));

// Import mocked modules
import { load, save, exists } from '../store.js';
import * as helpers from '../services/helpers.js';
import { runInitWizard, buildModelFromWizard } from '../init-wizard.js';
import { validateCaptable, validateCaptableExtended } from '../schema.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const mockLoad = load as Mock;
const mockSave = save as Mock;
const mockExists = exists as Mock;
const mockCreateSecurityClass = helpers.createSecurityClass as Mock;
const mockCreateStakeholder = helpers.createStakeholder as Mock;
const mockCreateIssuance = helpers.createIssuance as Mock;
const mockLogAction = helpers.logAction as Mock;
const mockRunInitWizard = runInitWizard as Mock;
const mockBuildModelFromWizard = buildModelFromWizard as Mock;
const mockValidateCaptable = validateCaptable as Mock;
const mockValidateCaptableExtended = validateCaptableExtended as Mock;
const mockZodToJsonSchema = zodToJsonSchema as Mock;
const mockRandomUUID = randomUUID as Mock;
const mockWriteFileSync = fs.writeFileSync as Mock;

describe('System Handlers', () => {
  const mockCommonStock: SecurityClass = {
    id: 'sc_common',
    kind: 'COMMON',
    label: 'Common Stock',
    authorized: 10000000,
    parValue: 0.00001,
  };

  const mockOptionPool: SecurityClass = {
    id: 'sc_option_pool',
    kind: 'OPTION_POOL',
    label: 'Stock Option Pool',
    authorized: 1000000,
  };

  const mockStakeholder: Stakeholder = {
    id: 'sh_founder',
    name: 'Founder',
    email: 'founder@test.com',
    type: 'person',
  };

  const mockIssuance: Issuance = {
    id: 'is_founder',
    stakeholderId: 'sh_founder',
    securityClassId: 'sc_common',
    qty: 8000000,
    pps: 0.00001,
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
    stakeholders: [mockStakeholder],
    securityClasses: [mockCommonStock, mockOptionPool],
    issuances: [mockIssuance],
    optionGrants: [],
    safes: [],
    valuations: [],
    audit: [
      {
        ts: '2024-01-01T10:00:00.000Z',
        by: 'captan-cli',
        action: 'INIT',
        data: {
          entity: 'system',
          entityId: 'captable',
          details: 'Initialized cap table for Test Company',
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRandomUUID.mockReturnValue('test-uuid');
  });

  describe('handleInit', () => {
    it('should initialize cap table with manual configuration', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass
        .mockReturnValueOnce(mockCommonStock)
        .mockReturnValueOnce(mockOptionPool);
      mockCreateStakeholder.mockReturnValue(mockStakeholder);
      mockCreateIssuance.mockReturnValue(mockIssuance);

      const result = await handleInit({
        name: 'Test Company',
        type: 'c-corp',
        state: 'DE',
        currency: 'USD',
        authorized: '10000000',
        par: '0.00001',
        poolPct: '10',
        founder: ['Founder:founder@test.com:8000000'],
        date: '2024-01-01',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Initialized cap table for Test Company');
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'COMMON',
        'Common Stock',
        10000000,
        0.00001
      );
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'OPTION_POOL',
        'Stock Option Pool',
        1000000
      );
      expect(mockCreateStakeholder).toHaveBeenCalledWith('Founder', 'founder@test.com', 'PERSON');
      expect(mockCreateIssuance).toHaveBeenCalledWith(
        'sh_founder',
        'sc_common',
        8000000,
        0.00001,
        '2024-01-01'
      );
      expect(mockLogAction).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should initialize with wizard mode', async () => {
      mockExists.mockReturnValue(false);
      const wizardResult = { name: 'Wizard Company' };
      mockRunInitWizard.mockResolvedValue(wizardResult);
      mockBuildModelFromWizard.mockReturnValue(mockCaptable);

      const result = await handleInit({ wizard: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Cap table initialized for Wizard Company');
      expect(mockRunInitWizard).toHaveBeenCalled();
      expect(mockBuildModelFromWizard).toHaveBeenCalledWith(wizardResult);
      expect(mockSave).toHaveBeenCalledWith(mockCaptable, 'captable.json');
    });

    it('should use default values when options not provided', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass.mockReturnValue(mockCommonStock);

      const result = await handleInit({ name: 'Test Company' });

      expect(result.success).toBe(true);
      expect(mockCreateSecurityClass).toHaveBeenCalledWith(
        'COMMON',
        'Common Stock',
        10000000, // default authorized
        0.00001 // default par value
      );
    });

    it('should handle s-corp entity type', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass.mockReturnValue(mockCommonStock);

      const result = await handleInit({
        name: 'Test Company',
        type: 's-corp',
      });

      expect(result.success).toBe(true);
      // Entity type should be converted from 's-corp' to 'S_CORP'
      expect(result.data?.company.entityType).toBe('S_CORP');
    });

    it('should handle llc entity type', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass.mockReturnValue(mockCommonStock);

      const result = await handleInit({
        name: 'Test Company',
        type: 'llc',
      });

      expect(result.success).toBe(true);
      expect(result.data?.company.entityType).toBe('LLC');
    });

    it('should skip option pool when poolPct is 0', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass.mockReturnValue(mockCommonStock);

      const result = await handleInit({
        name: 'Test Company',
        poolPct: '0',
      });

      expect(result.success).toBe(true);
      expect(mockCreateSecurityClass).toHaveBeenCalledTimes(1); // Only common stock
    });

    it('should handle multiple founders', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass.mockReturnValue(mockCommonStock);
      mockCreateStakeholder
        .mockReturnValueOnce({ ...mockStakeholder, id: 'sh_founder1' })
        .mockReturnValueOnce({ ...mockStakeholder, id: 'sh_founder2' });
      mockCreateIssuance
        .mockReturnValueOnce({ ...mockIssuance, id: 'is_founder1' })
        .mockReturnValueOnce({ ...mockIssuance, id: 'is_founder2' });

      const result = await handleInit({
        name: 'Test Company',
        founder: ['Founder1:founder1@test.com:4000000', 'Founder2:founder2@test.com:4000000'],
      });

      expect(result.success).toBe(true);
      expect(mockCreateStakeholder).toHaveBeenCalledTimes(2);
      expect(mockCreateIssuance).toHaveBeenCalledTimes(2);
    });

    it('should handle founder without shares', async () => {
      mockExists.mockReturnValue(false);
      mockCreateSecurityClass.mockReturnValue(mockCommonStock);
      mockCreateStakeholder.mockReturnValue(mockStakeholder);

      const result = await handleInit({
        name: 'Test Company',
        founder: ['Founder:founder@test.com:0'],
      });

      expect(result.success).toBe(true);
      expect(mockCreateStakeholder).toHaveBeenCalled();
      expect(mockCreateIssuance).not.toHaveBeenCalled(); // No shares issued
    });

    it('should fail when captable already exists', async () => {
      mockExists.mockReturnValue(true);

      const result = await handleInit({ name: 'Test Company' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ A captable.json file already exists');
    });

    it('should fail when no company name provided', async () => {
      mockExists.mockReturnValue(false);

      const result = await handleInit({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Company name is required');
    });

    it('should fail with invalid entity type', async () => {
      mockExists.mockReturnValue(false);

      const result = await handleInit({
        name: 'Test Company',
        type: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Invalid entity type');
    });

    it('should fail with invalid founder format', async () => {
      mockExists.mockReturnValue(false);

      const result = await handleInit({
        name: 'Test Company',
        founder: ['InvalidFormat'],
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Invalid founder format');
    });

    it('should handle wizard cancellation', async () => {
      mockExists.mockReturnValue(false);
      mockRunInitWizard.mockRejectedValue(new Error('User cancelled'));

      const result = await handleInit({ wizard: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Wizard cancelled or failed: User cancelled');
    });

    it('should handle errors gracefully', async () => {
      mockExists.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await handleInit({ name: 'Test Company' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleValidate', () => {
    it('should validate captable successfully', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockValidateCaptable.mockReturnValue({ valid: true });

      const result = handleValidate({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Validation passed');
      expect(result.message).toContain('1 stakeholders, 2 securities, 1 issuances');
      expect(mockValidateCaptable).toHaveBeenCalledWith(mockCaptable);
    });

    it('should validate with extended rules', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockValidateCaptable.mockReturnValue({ valid: true });
      mockValidateCaptableExtended.mockReturnValue({ valid: true });

      const result = handleValidate({ extended: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Validation passed');
      expect(mockValidateCaptableExtended).toHaveBeenCalledWith(mockCaptable);
    });

    it('should validate specific file', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockValidateCaptable.mockReturnValue({ valid: true });

      const result = handleValidate({ file: 'custom.json' });

      expect(result.success).toBe(true);
      expect(mockLoad).toHaveBeenCalledWith('custom.json');
    });

    it('should handle schema validation errors', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockValidateCaptable.mockReturnValue({
        valid: false,
        errors: ['Missing required field', 'Invalid type'],
      });

      const result = handleValidate({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Schema validation failed:');
      expect(result.message).toContain('Missing required field');
      expect(result.message).toContain('Invalid type');
    });

    it('should handle extended validation warnings', () => {
      mockLoad.mockReturnValue(mockCaptable);
      mockValidateCaptable.mockReturnValue({ valid: true });
      mockValidateCaptableExtended.mockReturnValue({
        valid: false,
        warnings: [{ message: 'Share utilization exceeds 100%' }, { message: 'Missing par value' }],
      });

      const result = handleValidate({ extended: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('⚠️ Business rule violations:');
      expect(result.message).toContain('Share utilization exceeds 100%');
      expect(result.message).toContain('Missing par value');
    });

    it('should handle undefined arrays in statistics', () => {
      const captableWithUndefined = {
        ...mockCaptable,
        issuances: undefined,
        optionGrants: undefined,
        safes: undefined,
      };
      mockLoad.mockReturnValue(captableWithUndefined);
      mockValidateCaptable.mockReturnValue({ valid: true });

      const result = handleValidate({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('1 stakeholders, 2 securities, 0 issuances');
    });

    it('should fail when file not found', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleValidate({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should fail when custom file not found', () => {
      mockLoad.mockImplementation((filename) => {
        throw new Error(
          `File not found: ${filename}. Run 'captan init' to create a new cap table.`
        );
      });

      const result = handleValidate({ file: 'missing.json' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: missing.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = handleValidate({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File read error');
    });
  });

  describe('handleSchema', () => {
    const mockSchema = {
      type: 'object',
      properties: {
        version: { type: 'number' },
        company: { type: 'object' },
      },
    };

    it('should generate schema to console', () => {
      mockZodToJsonSchema.mockReturnValue(mockSchema);

      const result = handleSchema({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSchema);

      const jsonData = JSON.parse(result.message);
      expect(jsonData).toEqual(mockSchema);
      expect(mockZodToJsonSchema).toHaveBeenCalled();
    });

    it('should write schema to file', () => {
      mockZodToJsonSchema.mockReturnValue(mockSchema);

      const result = handleSchema({ output: 'schema.json' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Schema written to schema.json');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'schema.json',
        expect.stringContaining('"type": "object"')
      );
    });

    it('should handle schema generation errors', () => {
      mockZodToJsonSchema.mockImplementation(() => {
        throw new Error('Schema generation failed');
      });

      const result = handleSchema({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Schema generation failed');
    });

    it('should handle file write errors', () => {
      mockZodToJsonSchema.mockReturnValue(mockSchema);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = handleSchema({ output: 'schema.json' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Permission denied');
    });
  });

  describe('handleLog', () => {
    it('should display audit log', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleLog({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('📝 Audit Log (last 1 entries)');
      expect(result.message).toContain('INIT - Initialized cap table for Test Company');
      expect(result.data).toEqual(mockCaptable.audit);
    });

    it('should filter by action', () => {
      const captableWithMultipleActions = {
        ...mockCaptable,
        audit: [
          ...mockCaptable.audit,
          {
            ts: '2024-01-02T10:00:00.000Z',
            by: 'captan-cli',
            action: 'STAKEHOLDER_ADD',
            data: {
              entity: 'stakeholder',
              entityId: 'sh_test',
              details: 'Added stakeholder',
            },
          },
        ],
      };
      mockLoad.mockReturnValue(captableWithMultipleActions);

      const result = handleLog({ action: 'INIT' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('INIT - Initialized cap table for Test Company');
      expect(result.message).not.toContain('STAKEHOLDER_ADD');
    });

    it('should limit results', () => {
      const captableWithManyLogs = {
        ...mockCaptable,
        audit: Array(30)
          .fill(mockCaptable.audit[0])
          .map((log, i) => ({
            ...log,
            ts: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
          })),
      };
      mockLoad.mockReturnValue(captableWithManyLogs);

      const result = handleLog({ limit: '5' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('📝 Audit Log (last 5 entries)');
      expect(result.data).toHaveLength(5);
    });

    it('should handle empty audit log', () => {
      const captableWithoutAudit = {
        ...mockCaptable,
        audit: [],
      };
      mockLoad.mockReturnValue(captableWithoutAudit);

      const result = handleLog({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No audit log entries found.');
    });

    it('should handle undefined audit log', () => {
      const captableWithoutAudit = {
        ...mockCaptable,
        audit: undefined,
      };
      mockLoad.mockReturnValue(captableWithoutAudit);

      const result = handleLog({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No audit log entries found.');
    });

    it('should handle filtered results with no matches', () => {
      mockLoad.mockReturnValue(mockCaptable);

      const result = handleLog({ action: 'NONEXISTENT' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('No audit log entries found.');
    });

    it('should fail when captable not found', () => {
      mockLoad.mockImplementation(() => {
        throw new Error(
          "File not found: captable.json. Run 'captan init' to create a new cap table."
        );
      });

      const result = handleLog({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File not found: captable.json');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleLog({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });
});
