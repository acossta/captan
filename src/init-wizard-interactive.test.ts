import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runInitWizard } from './init-wizard.js';
import * as prompts from '@inquirer/prompts';

// Mock all the prompt functions
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  number: vi.fn(),
}));

describe('runInitWizard - Interactive Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('C-Corporation flow', () => {
    it('should handle C-Corp with pool percentage and founders', async () => {
      // Mock the prompt responses in order
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      // Company basics
      mockInput.mockResolvedValueOnce('Tech Startup Inc.'); // company name
      mockInput.mockResolvedValueOnce('2024-01-15'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('DE'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency

      // Shares
      mockNumber.mockResolvedValueOnce(10000000); // authorized shares
      mockNumber.mockResolvedValueOnce(0.00001); // par value

      // Option pool
      mockConfirm.mockResolvedValueOnce(true); // create pool
      mockSelect.mockResolvedValueOnce('percent'); // pool type
      mockNumber.mockResolvedValueOnce(10); // pool percentage

      // Founders
      mockConfirm.mockResolvedValueOnce(true); // add founders
      mockInput.mockResolvedValueOnce('Alice Smith'); // founder 1 name
      mockInput.mockResolvedValueOnce('alice@techstartup.com'); // founder 1 email
      mockNumber.mockResolvedValueOnce(4000000); // founder 1 shares
      mockConfirm.mockResolvedValueOnce(true); // add another
      mockInput.mockResolvedValueOnce('Bob Jones'); // founder 2 name
      mockInput.mockResolvedValueOnce(''); // founder 2 email (empty)
      mockNumber.mockResolvedValueOnce(5000000); // founder 2 shares
      mockConfirm.mockResolvedValueOnce(false); // no more founders

      const result = await runInitWizard();

      expect(result).toEqual({
        name: 'Tech Startup Inc.',
        formationDate: '2024-01-15',
        entityType: 'C_CORP',
        jurisdiction: 'DE',
        currency: 'USD',
        authorized: 10000000,
        parValue: 0.00001,
        poolSize: undefined,
        poolPct: 10,
        founders: [
          { name: 'Alice Smith', email: 'alice@techstartup.com', shares: 4000000 },
          { name: 'Bob Jones', email: undefined, shares: 5000000 },
        ],
      });
    });

    it('should handle C-Corp with absolute pool size and no founders', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('Simple Corp'); // company name
      mockInput.mockResolvedValueOnce('2024-06-01'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('CA'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency
      mockNumber.mockResolvedValueOnce(5000000); // authorized shares
      mockNumber.mockResolvedValueOnce(0.001); // par value
      mockConfirm.mockResolvedValueOnce(true); // create pool
      mockSelect.mockResolvedValueOnce('absolute'); // pool type
      mockNumber.mockResolvedValueOnce(500000); // pool size
      mockConfirm.mockResolvedValueOnce(false); // no founders

      const result = await runInitWizard();

      expect(result).toEqual({
        name: 'Simple Corp',
        formationDate: '2024-06-01',
        entityType: 'C_CORP',
        jurisdiction: 'CA',
        currency: 'USD',
        authorized: 5000000,
        parValue: 0.001,
        poolSize: 500000,
        poolPct: undefined,
        founders: [],
      });
    });

    it('should handle C-Corp without pool', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('No Pool Corp'); // company name
      mockInput.mockResolvedValueOnce('2023-12-31'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('NY'); // jurisdiction
      mockInput.mockResolvedValueOnce('EUR'); // currency
      mockNumber.mockResolvedValueOnce(1000000); // authorized shares
      mockNumber.mockResolvedValueOnce(0.01); // par value
      mockConfirm.mockResolvedValueOnce(false); // no pool
      mockConfirm.mockResolvedValueOnce(false); // no founders

      const result = await runInitWizard();

      expect(result).toEqual({
        name: 'No Pool Corp',
        formationDate: '2023-12-31',
        entityType: 'C_CORP',
        jurisdiction: 'NY',
        currency: 'EUR',
        authorized: 1000000,
        parValue: 0.01,
        poolSize: undefined,
        poolPct: undefined,
        founders: [],
      });
    });
  });

  describe('S-Corporation flow', () => {
    it('should handle S-Corp setup', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('Small Business Corp'); // company name
      mockInput.mockResolvedValueOnce('2024-03-15'); // formation date
      mockSelect.mockResolvedValueOnce('S_CORP'); // entity type
      mockInput.mockResolvedValueOnce('TX'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency
      mockNumber.mockResolvedValueOnce(1000000); // authorized shares
      mockNumber.mockResolvedValueOnce(0.0001); // par value
      mockConfirm.mockResolvedValueOnce(true); // create pool
      mockSelect.mockResolvedValueOnce('percent'); // pool type
      mockNumber.mockResolvedValueOnce(15); // pool percentage
      mockConfirm.mockResolvedValueOnce(true); // add founders
      mockInput.mockResolvedValueOnce('John Doe'); // founder name
      mockInput.mockResolvedValueOnce('john@scorp.com'); // founder email
      mockNumber.mockResolvedValueOnce(850000); // founder shares
      mockConfirm.mockResolvedValueOnce(false); // no more founders

      const result = await runInitWizard();

      expect(result).toEqual({
        name: 'Small Business Corp',
        formationDate: '2024-03-15',
        entityType: 'S_CORP',
        jurisdiction: 'TX',
        currency: 'USD',
        authorized: 1000000,
        parValue: 0.0001,
        poolSize: undefined,
        poolPct: 15,
        founders: [{ name: 'John Doe', email: 'john@scorp.com', shares: 850000 }],
      });
    });
  });

  describe('LLC flow', () => {
    it('should handle LLC setup without par value', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('Tech Ventures LLC'); // company name
      mockInput.mockResolvedValueOnce('2024-02-01'); // formation date
      mockSelect.mockResolvedValueOnce('LLC'); // entity type
      mockInput.mockResolvedValueOnce('WY'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency
      mockNumber.mockResolvedValueOnce(1000000); // authorized units
      // No par value prompt for LLC
      mockConfirm.mockResolvedValueOnce(false); // no pool (typical for LLC)
      mockConfirm.mockResolvedValueOnce(true); // add members
      mockInput.mockResolvedValueOnce('Member One'); // member name
      mockInput.mockResolvedValueOnce('member1@llc.com'); // member email
      mockNumber.mockResolvedValueOnce(600000); // member units
      mockConfirm.mockResolvedValueOnce(true); // add another
      mockInput.mockResolvedValueOnce('Member Two'); // member name
      mockInput.mockResolvedValueOnce('member2@llc.com'); // member email
      mockNumber.mockResolvedValueOnce(400000); // member units
      mockConfirm.mockResolvedValueOnce(false); // no more members

      const result = await runInitWizard();

      expect(result).toEqual({
        name: 'Tech Ventures LLC',
        formationDate: '2024-02-01',
        entityType: 'LLC',
        jurisdiction: 'WY',
        currency: 'USD',
        authorized: 1000000,
        parValue: undefined, // LLC doesn't have par value
        poolSize: undefined,
        poolPct: undefined,
        founders: [
          { name: 'Member One', email: 'member1@llc.com', shares: 600000 },
          { name: 'Member Two', email: 'member2@llc.com', shares: 400000 },
        ],
      });
    });

    it('should handle LLC with pool (unusual but possible)', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('Innovative LLC'); // company name
      mockInput.mockResolvedValueOnce('2024-07-01'); // formation date
      mockSelect.mockResolvedValueOnce('LLC'); // entity type
      mockInput.mockResolvedValueOnce('NV'); // jurisdiction
      mockInput.mockResolvedValueOnce('GBP'); // currency
      mockNumber.mockResolvedValueOnce(500000); // authorized units
      mockConfirm.mockResolvedValueOnce(true); // create pool (unusual for LLC)
      mockSelect.mockResolvedValueOnce('absolute'); // pool type
      mockNumber.mockResolvedValueOnce(50000); // pool size
      mockConfirm.mockResolvedValueOnce(false); // no founders

      const result = await runInitWizard();

      expect(result).toEqual({
        name: 'Innovative LLC',
        formationDate: '2024-07-01',
        entityType: 'LLC',
        jurisdiction: 'NV',
        currency: 'GBP',
        authorized: 500000,
        parValue: undefined,
        poolSize: 50000,
        poolPct: undefined,
        founders: [],
      });
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle undefined/default values', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      // Return undefined for some optional fields
      mockInput.mockResolvedValueOnce('Default Corp'); // company name
      mockInput.mockResolvedValueOnce('2024-01-01'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('DE'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency
      mockNumber.mockResolvedValueOnce(undefined); // authorized shares (use default)
      mockNumber.mockResolvedValueOnce(undefined); // par value (leave blank -> undefined)
      mockConfirm.mockResolvedValueOnce(false); // no pool
      mockConfirm.mockResolvedValueOnce(false); // no founders

      const result = await runInitWizard();

      expect(result.authorized).toBe(10000000); // Should use default
      expect(result.parValue).toBeUndefined(); // Should be undefined when not provided
    });

    it('should skip founders with zero or undefined shares', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('Test Corp'); // company name
      mockInput.mockResolvedValueOnce('2024-01-01'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('DE'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency
      mockNumber.mockResolvedValueOnce(10000000); // authorized shares
      mockNumber.mockResolvedValueOnce(0.00001); // par value
      mockConfirm.mockResolvedValueOnce(false); // no pool
      mockConfirm.mockResolvedValueOnce(true); // add founders

      // First founder with zero shares (should be skipped)
      mockInput.mockResolvedValueOnce('Zero Founder'); // founder name
      mockInput.mockResolvedValueOnce('zero@test.com'); // founder email
      mockNumber.mockResolvedValueOnce(0); // zero shares
      mockConfirm.mockResolvedValueOnce(true); // add another

      // Second founder with undefined shares (should be skipped)
      mockInput.mockResolvedValueOnce('Undefined Founder'); // founder name
      mockInput.mockResolvedValueOnce('undefined@test.com'); // founder email
      mockNumber.mockResolvedValueOnce(undefined); // undefined shares
      mockConfirm.mockResolvedValueOnce(true); // add another

      // Third founder with valid shares
      mockInput.mockResolvedValueOnce('Valid Founder'); // founder name
      mockInput.mockResolvedValueOnce('valid@test.com'); // founder email
      mockNumber.mockResolvedValueOnce(1000000); // valid shares
      mockConfirm.mockResolvedValueOnce(false); // no more founders

      const result = await runInitWizard();

      // Should only have the valid founder
      expect(result.founders).toHaveLength(1);
      expect(result.founders[0]).toEqual({
        name: 'Valid Founder',
        email: 'valid@test.com',
        shares: 1000000,
      });
    });

    it('should handle pool percentage validation edge cases', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('Edge Case Corp'); // company name
      mockInput.mockResolvedValueOnce('2024-01-01'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('DE'); // jurisdiction
      mockInput.mockResolvedValueOnce('USD'); // currency
      mockNumber.mockResolvedValueOnce(10000000); // authorized shares
      mockNumber.mockResolvedValueOnce(0.00001); // par value
      mockConfirm.mockResolvedValueOnce(true); // create pool
      mockSelect.mockResolvedValueOnce('percent'); // pool type
      mockNumber.mockResolvedValueOnce(99); // 99% pool (edge case but valid)
      mockConfirm.mockResolvedValueOnce(false); // no founders

      const result = await runInitWizard();

      expect(result.poolPct).toBe(99); // Should accept 99%
    });

    it('should handle international settings', async () => {
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      mockInput.mockResolvedValueOnce('International Corp'); // company name
      mockInput.mockResolvedValueOnce('2024-01-01'); // formation date
      mockSelect.mockResolvedValueOnce('C_CORP'); // entity type
      mockInput.mockResolvedValueOnce('JP'); // Japan jurisdiction
      mockInput.mockResolvedValueOnce('JPY'); // Japanese Yen
      mockNumber.mockResolvedValueOnce(1000000); // authorized shares
      mockNumber.mockResolvedValueOnce(50); // par value in JPY
      mockConfirm.mockResolvedValueOnce(false); // no pool
      mockConfirm.mockResolvedValueOnce(false); // no founders

      const result = await runInitWizard();

      expect(result.jurisdiction).toBe('JP');
      expect(result.currency).toBe('JPY');
      expect(result.parValue).toBe(50);
    });
  });

  describe('Console output', () => {
    it('should log the wizard header', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const mockInput = vi.mocked(prompts.input);
      const mockSelect = vi.mocked(prompts.select);
      const mockConfirm = vi.mocked(prompts.confirm);
      const mockNumber = vi.mocked(prompts.number);

      // Minimal setup
      mockInput.mockResolvedValue('Test');
      mockSelect.mockResolvedValue('C_CORP');
      mockConfirm.mockResolvedValue(false);
      mockNumber.mockResolvedValue(1000000);

      await runInitWizard();

      expect(consoleSpy).toHaveBeenCalledWith('\n🧭 Captan Initialization Wizard\n');
      consoleSpy.mockRestore();
    });
  });
});
