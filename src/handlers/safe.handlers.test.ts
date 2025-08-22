import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  handleSafeAdd,
  handleSafeList,
  handleSafeShow,
  handleSafeUpdate,
  handleSafeDelete,
  handleSafeConvert,
} from './safe.handlers.js';
import type { FileModel, Stakeholder, SecurityClass, SAFE, Issuance } from '../model.js';

// Mock dependencies
vi.mock('../store.js', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../services/helpers.js', () => ({
  createSAFE: vi.fn(),
  calculateSAFEConversions: vi.fn(),
  createIssuance: vi.fn(),
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
const mockCreateSAFE = helpers.createSAFE as Mock;
const mockCalculateSAFEConversions = helpers.calculateSAFEConversions as Mock;
const mockCreateIssuance = helpers.createIssuance as Mock;
const mockLogAction = helpers.logAction as Mock;
const mockResolveStakeholder = resolveStakeholder as Mock;
const mockFormatStakeholderReference = formatStakeholderReference as Mock;

describe('SAFE Handlers', () => {
  const createMockStakeholder = (): Stakeholder => ({
    id: 'sh_investor',
    name: 'Investor',
    email: 'investor@test.com',
    type: 'entity',
  });

  const createMockCommonStock = (): SecurityClass => ({
    id: 'sc_common',
    kind: 'COMMON',
    label: 'Common Stock',
    authorized: 10000000,
  });

  const createMockSafe = (): SAFE => ({
    id: 'safe_investor',
    stakeholderId: 'sh_investor',
    amount: 500000,
    cap: 10000000,
    discount: 0.2,
    type: 'pre',
    date: '2024-01-01',
    note: 'Seed round investment',
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
    securityClasses: [createMockCommonStock()],
    issuances: [],
    optionGrants: [],
    safes: [createMockSafe()],
    valuations: [],
    audit: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSafeAdd', () => {
    it('should successfully add a pre-money SAFE with cap and discount', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockCreateSAFE.mockReturnValue({
        id: 'safe_new',
        stakeholderId: 'sh_investor',
        amount: 250000,
        cap: 8000000,
        discount: 0.15,
        type: 'pre',
        date: '2024-02-01',
        note: 'Follow-on investment',
      });
      mockFormatStakeholderReference.mockReturnValue('Investor (sh_investor, investor@test.com)');

      const result = handleSafeAdd({
        stakeholder: 'investor@test.com',
        amount: '250000',
        cap: '8000000',
        discount: '15',
        type: 'pre-money',
        date: '2024-02-01',
        note: 'Follow-on investment',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Added $250,000 SAFE for Investor');
      expect(result.message).toContain('$8,000,000 cap, 15% discount');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('investor@test.com');
      expect(mockCreateSAFE).toHaveBeenCalledWith(
        'sh_investor',
        250000,
        8000000,
        15,
        false,
        '2024-02-01',
        'Follow-on investment'
      );
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should add post-money SAFE with only cap', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockCreateSAFE.mockReturnValue({
        id: 'safe_new',
        stakeholderId: 'sh_investor',
        amount: 1000000,
        cap: 15000000,
        type: 'post',
        date: '2024-02-01',
      });
      mockFormatStakeholderReference.mockReturnValue('Investor (sh_investor)');

      const result = handleSafeAdd({
        stakeholder: 'sh_investor',
        amount: '1000000',
        cap: '15000000',
        type: 'post-money',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('$15,000,000 cap');
      expect(result.message).not.toContain('discount');
      expect(mockCreateSAFE).toHaveBeenCalledWith(
        'sh_investor',
        1000000,
        15000000,
        undefined,
        true,
        expect.any(String),
        undefined
      );
    });

    it('should add SAFE with only discount', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockCreateSAFE.mockReturnValue({
        id: 'safe_new',
        stakeholderId: 'sh_investor',
        amount: 100000,
        discount: 0.25,
        type: 'pre',
        date: '2024-02-01',
      });
      mockFormatStakeholderReference.mockReturnValue('Investor (sh_investor)');

      const result = handleSafeAdd({
        stakeholder: 'sh_investor',
        amount: '100000',
        discount: '25',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('25% discount');
      expect(result.message).not.toContain('cap');
      expect(mockCreateSAFE).toHaveBeenCalledWith(
        'sh_investor',
        100000,
        undefined,
        25,
        false,
        expect.any(String),
        undefined
      );
    });

    it('should use current date when date not provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });
      mockCreateSAFE.mockReturnValue(createMockSafe());
      mockFormatStakeholderReference.mockReturnValue('Investor (sh_investor)');

      const result = handleSafeAdd({
        stakeholder: 'sh_investor',
        amount: '100000',
        cap: '5000000',
      });

      expect(result.success).toBe(true);
      expect(mockCreateSAFE).toHaveBeenCalledWith(
        'sh_investor',
        100000,
        5000000,
        undefined,
        false,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        undefined
      );
    });

    it('should fail when stakeholder not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleSafeAdd({
        stakeholder: 'nonexistent@test.com',
        amount: '100000',
        cap: '5000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when neither cap nor discount provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });

      const result = handleSafeAdd({
        stakeholder: 'sh_investor',
        amount: '100000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        '❌ SAFE must have either a valuation cap or discount (or both)'
      );
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleSafeAdd({
        stakeholder: 'sh_investor',
        amount: '100000',
        cap: '5000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleSafeAdd({
        stakeholder: 'sh_investor',
        amount: '100000',
        cap: '5000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleSafeList', () => {
    it('should list all SAFEs in table format', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('💰 SAFE Investments');
      expect(result.message).toContain('safe_investor');
      expect(result.message).toContain('Investor');
      expect(result.message).toContain('$500,000');
      expect(result.message).toContain('$10,000,000');
      expect(result.message).toContain('20%');
      expect(result.message).toContain('Pre');
      expect(result.message).toContain('Total SAFE investment:');
    });

    it('should list SAFEs without discount', () => {
      const safeWithoutDiscount = { ...createMockSafe(), discount: undefined };
      const captableWithoutDiscount = {
        ...createMockCaptable(),
        safes: [safeWithoutDiscount],
      };
      mockLoad.mockReturnValue(captableWithoutDiscount);

      const result = handleSafeList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('-'); // Shows "-" for missing discount
    });

    it('should list post-money SAFEs', () => {
      const postMoneySafe = { ...createMockSafe(), type: 'post' as const };
      const captableWithPostMoney = {
        ...createMockCaptable(),
        safes: [postMoneySafe],
      };
      mockLoad.mockReturnValue(captableWithPostMoney);

      const result = handleSafeList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Post');
    });

    it('should filter SAFEs by stakeholder', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: true,
        stakeholder: createMockStakeholder(),
      });

      const result = handleSafeList({ stakeholder: 'investor@test.com' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('💰 SAFE Investments');
      expect(mockResolveStakeholder).toHaveBeenCalledWith('investor@test.com');
    });

    it('should fail when filtering by nonexistent stakeholder', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockResolveStakeholder.mockReturnValue({
        success: false,
        error: 'No stakeholder found with email: nonexistent@test.com',
      });

      const result = handleSafeList({ stakeholder: 'nonexistent@test.com' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No stakeholder found with email: nonexistent@test.com');
    });

    it('should return JSON format when requested', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeList({ format: 'json' });

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.message);
      expect(jsonData.length).toBeGreaterThan(0);
      expect(jsonData.some((safe: any) => safe.id === 'safe_investor')).toBe(true);
      expect(jsonData[0]).toMatchObject({
        id: 'safe_investor',
        stakeholderId: 'sh_investor',
        amount: 500000,
        cap: 10000000,
        discount: 0.2,
        type: 'pre',
        date: '2024-01-01',
        note: 'Seed round investment',
      });
    });

    it('should handle empty SAFEs list', () => {
      const emptyCaptable = { ...createMockCaptable(), safes: [] };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleSafeList({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No SAFEs found');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleSafeList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handleSafeList({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: Database error');
    });
  });

  describe('handleSafeShow', () => {
    it('should show SAFE details with all terms', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeShow('safe_investor', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('💰 SAFE Details');
      expect(result.message).toContain('safe_investor');
      expect(result.message).toContain('2024-01-01');
      expect(result.message).toContain('Investor (sh_investor)');
      expect(result.message).toContain('$500,000');
      expect(result.message).toContain('Pre-money');
      expect(result.message).toContain('📊 Terms');
      expect(result.message).toContain('Valuation Cap:  $10,000,000');
      expect(result.message).toContain('Discount:       20.0%');
      expect(result.message).toContain('📝 Note: Seed round investment');
      expect(result.message).toContain('🔄 Conversion Scenarios');
      expect(result.message).toContain('At cap:');
      expect(result.message).toContain('With discount:  Price reduced by 20%');
    });

    it('should show SAFE details without discount', () => {
      const safeWithoutDiscount = { ...createMockSafe(), discount: undefined };
      const captableWithoutDiscount = {
        ...createMockCaptable(),
        safes: [safeWithoutDiscount],
      };
      mockLoad.mockReturnValue(captableWithoutDiscount);

      const result = handleSafeShow('safe_investor', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('💰 SAFE Details');
      expect(result.message).not.toContain('Discount:');
      expect(result.message).not.toContain('With discount:');
    });

    it('should show SAFE details without cap', () => {
      const safeWithoutCap = { ...createMockSafe(), cap: undefined };
      const captableWithoutCap = {
        ...createMockCaptable(),
        safes: [safeWithoutCap],
      };
      mockLoad.mockReturnValue(captableWithoutCap);

      const result = handleSafeShow('safe_investor', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('💰 SAFE Details');
      expect(result.message).not.toContain('Valuation Cap:');
      expect(result.message).not.toContain('At cap:');
    });

    it('should show SAFE details without note', () => {
      const safeWithoutNote = { ...createMockSafe(), note: undefined };
      const captableWithoutNote = {
        ...createMockCaptable(),
        safes: [safeWithoutNote],
      };
      mockLoad.mockReturnValue(captableWithoutNote);

      const result = handleSafeShow('safe_investor', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('💰 SAFE Details');
      expect(result.message).not.toContain('📝 Note:');
    });

    it('should fail when no SAFE ID provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeShow(undefined, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a SAFE ID');
    });

    it('should fail when SAFE not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeShow('safe_nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ SAFE not found: safe_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleSafeShow('safe_investor', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });
  });

  describe('handleSafeUpdate', () => {
    it('should update SAFE valuation cap', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeUpdate('safe_investor', {
        cap: '12000000',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated SAFE safe_investor');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should update SAFE discount', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeUpdate('safe_investor', {
        discount: '25',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated SAFE safe_investor');
    });

    it('should update both cap and discount', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeUpdate('safe_investor', {
        cap: '15000000',
        discount: '30',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Updated SAFE safe_investor');
    });

    it('should fail when no SAFE ID provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeUpdate(undefined, { cap: '12000000' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a SAFE ID');
    });

    it('should fail when no updates provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeUpdate('safe_investor', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No updates provided');
      expect(result.message).toContain('Use --cap or --discount to update');
    });

    it('should fail when SAFE not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeUpdate('safe_nonexistent', { cap: '12000000' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ SAFE not found: safe_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleSafeUpdate('safe_investor', { cap: '12000000' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });
  });

  describe('handleSafeDelete', () => {
    it('should delete SAFE with force flag', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeDelete('safe_investor', { force: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Deleted SAFE safe_investor');
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should fail to delete without force flag', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeDelete('safe_investor', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ This will delete a $500,000 investment from Investor');
      expect(result.message).toContain('Use --force to confirm');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when no SAFE ID provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeDelete(undefined, { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Please provide a SAFE ID');
    });

    it('should fail when SAFE not found', () => {
      mockLoad.mockReturnValue(createMockCaptable());

      const result = handleSafeDelete('safe_nonexistent', { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ SAFE not found: safe_nonexistent');
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleSafeDelete('safe_investor', { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleSafeDelete('safe_investor', { force: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });

  describe('handleSafeConvert', () => {
    const mockConversions = [
      {
        safe: createMockSafe(),
        shares: 500000,
        conversionPrice: 1.0,
        conversionReason: 'cap' as const,
      },
    ];

    it('should preview SAFE conversions in dry run mode', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockCalculateSAFEConversions.mockReturnValue(mockConversions);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
        newMoney: '1000000',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('🔄 SAFE Conversion Preview');
      expect(result.message).toContain('Pre-money valuation: $5,000,000');
      expect(result.message).toContain('Price per share: $1');
      expect(result.message).toContain('New money raised: $1,000,000');
      expect(result.message).toContain('Investor:');
      expect(result.message).toContain('Investment: $500,000');
      expect(result.message).toContain('Shares: 500,000 at $1/share (cap)');
      expect(result.message).toContain('Total new shares: 500,000');
      expect(mockCalculateSAFEConversions).toHaveBeenCalledWith(createMockCaptable(), 1.0, 5000000);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should preview conversions without new money', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockCalculateSAFEConversions.mockReturnValue(mockConversions);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('🔄 SAFE Conversion Preview');
      expect(result.message).not.toContain('New money raised:');
    });

    it('should show discount conversion reason', () => {
      const discountConversions = [
        {
          safe: createMockSafe(),
          shares: 625000,
          conversionPrice: 0.8,
          conversionReason: 'discount' as const,
        },
      ];
      mockLoad.mockReturnValue(createMockCaptable());
      mockCalculateSAFEConversions.mockReturnValue(discountConversions);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Shares: 625,000 at $0.8/share (discount)');
    });

    it('should show round price conversion reason', () => {
      const priceConversions = [
        {
          safe: createMockSafe(),
          shares: 500000,
          conversionPrice: 1.0,
          conversionReason: 'price' as const,
        },
      ];
      mockLoad.mockReturnValue(createMockCaptable());
      mockCalculateSAFEConversions.mockReturnValue(priceConversions);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Shares: 500,000 at $1/share (round price)');
    });

    it('should execute SAFE conversion', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockCalculateSAFEConversions.mockReturnValue(mockConversions);
      mockCreateIssuance.mockReturnValue({
        id: 'is_conversion',
        stakeholderId: 'sh_investor',
        securityClassId: 'sc_common',
        qty: 500000,
        pps: 1.0,
        date: '2024-02-01',
      });

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
        date: '2024-02-01',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Converted 1 SAFEs into 500,000 shares');
      expect(mockCreateIssuance).toHaveBeenCalledWith(
        'sh_investor',
        'sc_common',
        500000,
        1.0,
        '2024-02-01'
      );
      expect(mockSave).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should use current date when date not provided', () => {
      mockLoad.mockReturnValue(createMockCaptable());
      mockCalculateSAFEConversions.mockReturnValue(mockConversions);
      mockCreateIssuance.mockReturnValue({
        id: 'is_conversion',
        stakeholderId: 'sh_investor',
        securityClassId: 'sc_common',
        qty: 500000,
        pps: 1.0,
        date: expect.any(String),
      });

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
      });

      expect(result.success).toBe(true);
      expect(mockCreateIssuance).toHaveBeenCalledWith(
        'sh_investor',
        'sc_common',
        500000,
        1.0,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });

    it('should handle no SAFEs to convert', () => {
      const emptyCaptable = { ...createMockCaptable(), safes: [] };
      mockLoad.mockReturnValue(emptyCaptable);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No SAFEs to convert');
      expect(mockCalculateSAFEConversions).not.toHaveBeenCalled();
    });

    it('should fail when no common stock found', () => {
      const captableWithoutCommon = {
        ...createMockCaptable(),
        securityClasses: [],
      };
      mockLoad.mockReturnValue(captableWithoutCommon);
      mockCalculateSAFEConversions.mockReturnValue(mockConversions);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No common stock security class found');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should fail when captable does not exist', () => {
      mockLoad.mockReturnValue(null);

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ No captable.json found');
    });

    it('should handle errors gracefully', () => {
      mockLoad.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleSafeConvert({
        preMoney: '5000000',
        pps: '1.00',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Error: File system error');
    });
  });
});
