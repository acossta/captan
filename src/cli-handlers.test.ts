import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as handlers from './cli-handlers.js';
import * as store from './store.js';
import * as initWizard from './init-wizard.js';
import { FileModel } from './model.js';
import { AuditService } from './services/audit-service.js';

// Mock all dependencies
vi.mock('./store.js', () => ({
  exists: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('./init-wizard.js', () => ({
  runInitWizard: vi.fn(),
  parseFounderString: vi.fn(),
  calculatePoolFromPercentage: vi.fn(),
  buildModelFromWizard: vi.fn(),
}));

const mockStakeholderService = {
  addStakeholder: vi.fn(),
  getStakeholder: vi.fn(),
  listStakeholders: vi.fn(),
};

vi.mock('./services/stakeholder-service.js', () => ({
  StakeholderService: vi.fn().mockImplementation(() => mockStakeholderService),
}));

const mockSecurityService = {
  addSecurityClass: vi
    .fn()
    .mockReturnValue({ id: 'sc_new', kind: 'COMMON', label: 'Test', authorized: 1000000 }),
  getSecurityClass: vi
    .fn()
    .mockImplementation((id) =>
      id === 'sc_common'
        ? { id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000 }
        : id === 'sc_pool'
          ? { id: 'sc_pool', kind: 'OPTION_POOL', label: 'Option Pool', authorized: 2000000 }
          : null
    ),
  listSecurityClasses: vi.fn().mockReturnValue([]),
  listByKind: vi
    .fn()
    .mockImplementation((kind) =>
      kind === 'COMMON'
        ? [{ id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000 }]
        : kind === 'OPTION_POOL'
          ? [{ id: 'sc_pool', kind: 'OPTION_POOL', label: 'Option Pool', authorized: 2000000 }]
          : []
    ),
  validateSecurityClassExists: vi.fn(),
  validatePoolCapacity: vi.fn().mockReturnValue({
    authorized: 2000000,
    granted: 0,
    remaining: 2000000,
  }),
  getRemainingAuthorized: vi.fn().mockReturnValue(10000000),
  getIssuedByClass: vi.fn().mockReturnValue(0),
};

vi.mock('./services/security-service.js', () => ({
  SecurityService: vi.fn().mockImplementation(() => mockSecurityService),
}));

const mockEquityService = {
  issueShares: vi.fn().mockReturnValue({ id: 'is_new', qty: 1000000, pps: 0.0001 }),
  grantOptions: vi.fn().mockReturnValue({ id: 'og_new', qty: 100000, exercise: 0.5 }),
  getIssuancesByStakeholder: vi.fn().mockReturnValue([]),
  getGrantsByStakeholder: vi.fn().mockReturnValue([]),
};

vi.mock('./services/equity-service.js', () => ({
  EquityService: vi.fn().mockImplementation(() => mockEquityService),
}));

vi.mock('./services/reporting-service.js', () => ({
  ReportingService: vi.fn().mockImplementation(() => ({
    generateCapTable: vi.fn().mockReturnValue({
      rows: [
        {
          name: 'Alice',
          outstanding: 1000000,
          pctOutstanding: 1.0,
          fullyDiluted: 1000000,
          pctFullyDiluted: 1.0,
        },
      ],
      totals: {
        outstandingTotal: 1000000,
        issuedTotal: 1000000,
        vestedOptions: 0,
        unvestedOptions: 0,
        fd: {
          issued: 1000000,
          grants: 0,
          poolRemaining: 0,
          totalFD: 1000000,
        },
      },
    }),
    exportJSON: vi.fn().mockReturnValue('{"data": "json"}'),
    exportCSV: vi.fn().mockReturnValue('csv,data'),
    generateSummary: vi.fn().mockReturnValue('Summary output'),
    generateStakeholderReport: vi.fn().mockReturnValue('Stakeholder report'),
    generateSecurityClassReport: vi.fn().mockReturnValue('Security class report'),
  })),
}));

vi.mock('./services/audit-service.js', () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    logAction: vi.fn(),
    getRecentActions: vi
      .fn()
      .mockReturnValue([
        { ts: '2024-01-01T12:00:00Z', action: 'INIT', data: { company: 'Test Co' }, by: 'cli' },
      ]),
  })),
}));

const mockSAFEService = {
  addSAFE: vi.fn(),
  getSAFE: vi.fn(),
  listSAFEs: vi.fn(),
  simulateConversion: vi.fn(),
};

vi.mock('./services/safe-service.js', () => ({
  SAFEService: vi.fn().mockImplementation(() => mockSAFEService),
}));

describe('CLI Handlers', () => {
  let mockModel: FileModel;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock return values
    mockStakeholderService.addStakeholder.mockReturnValue({
      id: 'sh_new',
      name: 'Test',
      type: 'person',
    });
    mockStakeholderService.getStakeholder.mockImplementation((id) =>
      id === 'sh_alice'
        ? { id: 'sh_alice', name: 'Alice', type: 'person' }
        : id === 'sh_bob'
          ? { id: 'sh_bob', name: 'Bob', type: 'person' }
          : id === 'sh_investor'
            ? { id: 'sh_investor', name: 'Investor', type: 'entity' }
            : null
    );
    mockStakeholderService.listStakeholders.mockReturnValue([]);

    mockSAFEService.addSAFE.mockReturnValue({
      id: 'safe_new',
      amount: 250000,
      cap: 5000000,
      discount: 0.8,
    });
    mockSAFEService.listSAFEs.mockReturnValue([]);
    mockSAFEService.simulateConversion.mockReturnValue([
      {
        stakeholderId: 'sh_alice',
        sharesIssued: 125000,
        conversionPrice: 2.0,
        conversionReason: 'cap',
        stakeholderName: 'Alice',
      },
    ]);

    // Reset EquityService mock for convert tests
    mockEquityService.issueShares.mockReturnValue({
      id: 'is_converted',
      qty: 125000,
      pps: 2.0,
      stakeholderId: 'sh_alice',
      securityClassId: 'sc_common',
      date: '2024-01-01',
    });

    mockModel = {
      version: 1,
      company: {
        id: 'comp_123',
        name: 'Test Co',
        formationDate: '2024-01-01',
        entityType: 'C_CORP',
        jurisdiction: 'DE',
        currency: 'USD',
      },
      stakeholders: [],
      securityClasses: [],
      issuances: [],
      optionGrants: [],
      safes: [],
      valuations: [],
      audit: [],
    };

    (store.load as Mock).mockReturnValue(mockModel);
  });

  describe('handleInit', () => {
    it('should create captable with default values', async () => {
      (store.exists as Mock).mockReturnValue(false);

      const result = await handlers.handleInit({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Created captable.json');
      expect(store.save).toHaveBeenCalled();
    });

    it('should fail if captable already exists', async () => {
      (store.exists as Mock).mockReturnValue(true);

      const result = await handlers.handleInit({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(store.save).not.toHaveBeenCalled();
    });

    it('should use wizard when specified', async () => {
      (store.exists as Mock).mockReturnValue(false);
      (initWizard.runInitWizard as Mock).mockResolvedValue({
        name: 'Wizard Co',
        entityType: 'C_CORP',
      });
      (initWizard.buildModelFromWizard as Mock).mockReturnValue(mockModel);

      const result = await handlers.handleInit({ wizard: true });

      expect(result.success).toBe(true);
      expect(initWizard.runInitWizard).toHaveBeenCalled();
      expect(initWizard.buildModelFromWizard).toHaveBeenCalled();
    });

    it('should handle custom company name and type', async () => {
      (store.exists as Mock).mockReturnValue(false);

      const result = await handlers.handleInit({
        name: 'Custom Co',
        type: 'llc',
        state: 'CA',
        currency: 'EUR',
      });

      expect(result.success).toBe(true);
      const savedModel = (store.save as Mock).mock.calls[0][0];
      expect(savedModel.company.name).toBe('Custom Co');
      expect(savedModel.company.entityType).toBe('LLC');
      expect(savedModel.company.jurisdiction).toBe('CA');
      expect(savedModel.company.currency).toBe('EUR');
    });

    it('should handle founders', async () => {
      (store.exists as Mock).mockReturnValue(false);
      (initWizard.parseFounderString as Mock).mockImplementation((str) => {
        const parts = str.split(':');
        return {
          name: parts[0],
          shares: parseInt(parts[1]),
        };
      });

      const result = await handlers.handleInit({
        founder: ['Alice:1000000', 'Bob:500000'],
      });

      expect(result.success).toBe(true);
      const savedModel = (store.save as Mock).mock.calls[0][0];
      expect(savedModel.stakeholders).toHaveLength(2);
      expect(savedModel.issuances).toHaveLength(2);
    });

    it('should create option pool when specified', async () => {
      (store.exists as Mock).mockReturnValue(false);

      const result = await handlers.handleInit({
        pool: '2000000',
      });

      expect(result.success).toBe(true);
      const savedModel = (store.save as Mock).mock.calls[0][0];
      const pool = savedModel.securityClasses.find((sc: any) => sc.kind === 'OPTION_POOL');
      expect(pool).toBeDefined();
      expect(pool?.authorized).toBe(2000000);
    });

    it('should calculate pool from percentage', async () => {
      (store.exists as Mock).mockReturnValue(false);
      (initWizard.calculatePoolFromPercentage as Mock).mockReturnValue(2000000);
      (initWizard.parseFounderString as Mock).mockImplementation((str) => {
        const parts = str.split(':');
        return {
          name: parts[0],
          shares: parseInt(parts[1]),
        };
      });

      const result = await handlers.handleInit({
        founder: ['Alice:8000000'],
        poolPct: '20',
      });

      expect(result.success).toBe(true);
      expect(initWizard.calculatePoolFromPercentage).toHaveBeenCalledWith(8000000, 20);
    });
  });

  describe('handleStakeholder', () => {
    it('should add individual stakeholder', () => {
      const result = handlers.handleStakeholder({
        name: 'Charlie',
        email: 'charlie@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added stakeholder');
      expect(store.save).toHaveBeenCalled();
    });

    it('should add entity stakeholder', () => {
      mockStakeholderService.addStakeholder.mockReturnValue({
        id: 'sh_acme',
        name: 'Acme Fund',
        type: 'entity',
      });

      const result = handlers.handleStakeholder({
        name: 'Acme Fund',
        entity: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Acme Fund');
    });

    it('should handle errors', () => {
      (store.load as Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = handlers.handleStakeholder({
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database error');
    });
  });

  describe('handleIssue', () => {
    beforeEach(() => {
      mockModel.securityClasses = [
        { id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000 },
      ];
      mockModel.stakeholders = [{ id: 'sh_alice', name: 'Alice', type: 'person' }];
    });

    it('should issue shares', () => {
      mockEquityService.issueShares.mockReturnValue({
        id: 'is_test',
        qty: 1000000,
        pps: 0.0001,
        stakeholderId: 'sh_alice',
        securityClassId: 'sc_common',
        date: '2024-01-01',
      });

      const result = handlers.handleIssue({
        stakeholder: 'sh_alice',
        qty: '1000000',
        price: '0.0001',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Issued 1,000,000');
      expect(store.save).toHaveBeenCalled();
    });

    it('should use default common stock class', () => {
      const result = handlers.handleIssue({
        stakeholder: 'sh_alice',
        qty: '500000',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Common Stock');
    });

    it('should handle no common stock class', () => {
      mockModel.securityClasses = [];
      mockSecurityService.listByKind.mockReturnValue([]);

      const result = handlers.handleIssue({
        stakeholder: 'sh_alice',
        qty: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No common stock/units class found');
    });
  });

  describe('handleGrant', () => {
    beforeEach(() => {
      mockModel.securityClasses = [
        { id: 'sc_pool', kind: 'OPTION_POOL', label: 'Option Pool', authorized: 2000000 },
      ];
      mockModel.stakeholders = [{ id: 'sh_bob', name: 'Bob', type: 'person' }];

      // Make sure the mock returns the option pool
      mockSecurityService.listByKind.mockImplementation((kind) =>
        kind === 'OPTION_POOL'
          ? [{ id: 'sc_pool', kind: 'OPTION_POOL', label: 'Option Pool', authorized: 2000000 }]
          : []
      );
      mockSecurityService.validatePoolCapacity.mockReturnValue({
        authorized: 2000000,
        granted: 0,
        remaining: 2000000,
      });
    });

    it('should grant options', () => {
      const result = handlers.handleGrant({
        stakeholder: 'sh_bob',
        qty: '100000',
        exercise: '0.5',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Granted 100,000 options');
      expect(result.message).toContain('$0.5/share');
    });

    it('should grant options with vesting', () => {
      const result = handlers.handleGrant({
        stakeholder: 'sh_bob',
        qty: '100000',
        exercise: '0.5',
        vestMonths: '48',
        vestCliff: '12',
        vestStart: '2024-01-01',
      });

      expect(result.success).toBe(true);
      expect(store.save).toHaveBeenCalled();
    });

    it('should handle no option pool', () => {
      mockModel.securityClasses = [];
      mockSecurityService.listByKind.mockImplementation((kind) =>
        kind === 'OPTION_POOL' ? [] : []
      );

      const result = handlers.handleGrant({
        stakeholder: 'sh_bob',
        qty: '100000',
        exercise: '0.5',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No option pool found');
    });
  });

  describe('handleSAFE', () => {
    beforeEach(() => {
      mockModel.stakeholders = [{ id: 'sh_investor', name: 'Investor', type: 'entity' }];
    });

    it('should add SAFE with cap and discount', () => {
      const result = handlers.handleSAFE({
        stakeholder: 'sh_investor',
        amount: '250000',
        cap: '5000000',
        discount: '20',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('$250,000');
      expect(result.message).toContain('cap: $5,000,000');
      expect(result.message).toContain('discount: 20%');
    });

    it('should add post-money SAFE', () => {
      const result = handlers.handleSAFE({
        stakeholder: 'sh_investor',
        amount: '100000',
        cap: '10000000',
        postMoney: true,
        note: 'Seed round',
      });

      expect(result.success).toBe(true);
      expect(store.save).toHaveBeenCalled();
    });

    it('should add SAFE without terms', () => {
      mockSAFEService.addSAFE.mockReturnValue({
        id: 'safe_noterms',
        amount: 50000,
        stakeholderId: 'sh_investor',
      });

      const result = handlers.handleSAFE({
        stakeholder: 'sh_investor',
        amount: '50000',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('$50,000');
      expect(result.message).not.toContain('cap:');
    });
  });

  describe('handleChart', () => {
    it('should generate chart', () => {
      const result = handlers.handleChart({});

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should generate chart for specific date', () => {
      const result = handlers.handleChart({
        date: '2025-01-01',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('handleExport', () => {
    it('should export as JSON', () => {
      const result = handlers.handleExport('json', {});

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should export as CSV', () => {
      const result = handlers.handleExport('csv', { includeOptions: true });

      expect(result.success).toBe(true);
    });

    it('should export summary', () => {
      const result = handlers.handleExport('summary', {});

      expect(result.success).toBe(true);
    });

    it('should handle unknown format', () => {
      const result = handlers.handleExport('unknown', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown export format');
    });
  });

  describe('handleReport', () => {
    beforeEach(() => {
      mockModel.stakeholders = [{ id: 'sh_alice', name: 'Alice', type: 'person' }];
      mockModel.securityClasses = [
        { id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000 },
      ];
    });

    it('should generate stakeholder report', () => {
      const result = handlers.handleReport({
        type: 'stakeholder',
        id: 'sh_alice',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should generate security class report', () => {
      const result = handlers.handleReport({
        type: 'class',
        id: 'sc_common',
      });

      expect(result.success).toBe(true);
    });

    it('should handle unknown report type', () => {
      const result = handlers.handleReport({
        type: 'unknown',
        id: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown report type');
    });
  });

  describe('handleLog', () => {
    beforeEach(() => {
      mockModel.audit = [
        { ts: '2024-01-01T12:00:00Z', action: 'INIT', data: { company: 'Test Co' }, by: 'cli' },
        {
          ts: '2024-01-02T12:00:00Z',
          action: 'STAKEHOLDER_ADDED',
          data: { name: 'Alice' },
          by: 'cli',
        },
      ];
    });

    it('should show audit log', () => {
      const result = handlers.handleLog({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Audit Log');
      expect(result.message).toContain('INIT');
    });

    it('should limit log entries', () => {
      const result = handlers.handleLog({ limit: '1' });

      expect(result.success).toBe(true);
      const logs = result.data as any[];
      expect(logs).toHaveLength(1);
    });

    it('should handle empty audit log', () => {
      mockModel.audit = [];

      // Create a temporary mock that returns empty array
      const originalMock = vi.mocked(AuditService);
      originalMock.mockImplementationOnce(() => ({
        logAction: vi.fn(),
        getRecentActions: vi.fn().mockReturnValue([]),
      }));

      const result = handlers.handleLog({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No audit logs found');
    });
  });

  describe('handleList', () => {
    beforeEach(() => {
      mockModel.stakeholders = [
        { id: 'sh_alice', name: 'Alice', type: 'person', email: 'alice@example.com' },
        { id: 'sh_bob', name: 'Bob', type: 'person' },
      ];
      mockModel.securityClasses = [
        {
          id: 'sc_common',
          kind: 'COMMON',
          label: 'Common Stock',
          authorized: 10000000,
          parValue: 0.0001,
        },
      ];
      mockModel.safes = [
        {
          id: 'safe_001',
          stakeholderId: 'sh_alice',
          amount: 250000,
          cap: 5000000,
          date: '2024-01-01',
        },
      ];
    });

    it('should list stakeholders', () => {
      mockStakeholderService.listStakeholders.mockReturnValue([
        { id: 'sh_alice', name: 'Alice', type: 'person', email: 'alice@example.com' },
        { id: 'sh_bob', name: 'Bob', type: 'person' },
      ]);

      const result = handlers.handleList({ type: 'stakeholders' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Alice');
      expect(result.message).toContain('Bob');
      expect(result.message).toContain('alice@example.com');
    });

    it('should list security classes', () => {
      mockSecurityService.listSecurityClasses.mockReturnValue([
        {
          id: 'sc_common',
          kind: 'COMMON',
          label: 'Common Stock',
          authorized: 10000000,
          parValue: 0.0001,
        },
      ]);

      const result = handlers.handleList({ type: 'classes' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Common Stock');
      expect(result.message).toContain('10,000,000');
      expect(result.message).toContain('Par: $0.0001');
    });

    it('should list SAFEs', () => {
      mockSAFEService.listSAFEs.mockReturnValue([
        {
          id: 'safe_001',
          stakeholderId: 'sh_alice',
          amount: 250000,
          cap: 5000000,
          date: '2024-01-01',
        },
      ]);

      const result = handlers.handleList({ type: 'safes' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('$250,000');
      expect(result.message).toContain('Cap: $5,000,000');
    });

    it('should handle unknown list type', () => {
      const result = handlers.handleList({ type: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown list type');
    });

    it('should handle empty lists', () => {
      mockModel.stakeholders = [];

      const result = handlers.handleList({ type: 'stakeholders' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No stakeholders found');
    });
  });

  describe('handleEnlist', () => {
    beforeEach(() => {
      mockModel.stakeholders = [
        { id: 'sh_alice', name: 'Alice', type: 'person' },
        { id: 'sh_bob', name: 'Bob', type: 'person' },
      ];
    });

    it('should list stakeholders in simple format', () => {
      mockStakeholderService.listStakeholders.mockReturnValue([
        { id: 'sh_alice', name: 'Alice', type: 'person' },
        { id: 'sh_bob', name: 'Bob', type: 'person' },
      ]);

      const result = handlers.handleEnlist();

      expect(result.success).toBe(true);
      expect(result.message).toContain('sh_alice\tAlice');
      expect(result.message).toContain('sh_bob\tBob');
    });

    it('should handle empty stakeholder list', () => {
      mockModel.stakeholders = [];

      const result = handlers.handleEnlist();

      expect(result.success).toBe(true);
      expect(result.message).toBe('No stakeholders found');
    });
  });

  describe('handleConvert', () => {
    beforeEach(() => {
      mockModel.safes = [
        {
          id: 'safe_001',
          stakeholderId: 'sh_alice',
          amount: 250000,
          cap: 5000000,
          date: '2024-01-01',
        },
        {
          id: 'safe_002',
          stakeholderId: 'sh_bob',
          amount: 100000,
          discount: 0.8,
          date: '2024-01-01',
        },
      ];
      mockModel.stakeholders = [
        { id: 'sh_alice', name: 'Alice', type: 'person' },
        { id: 'sh_bob', name: 'Bob', type: 'person' },
      ];

      // Set up mocks for SAFE conversion
      mockSecurityService.listByKind.mockImplementation((kind) =>
        kind === 'COMMON'
          ? [{ id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000 }]
          : []
      );
    });

    it('should convert SAFEs at given price', () => {
      const result = handlers.handleConvert({
        price: '2.0',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('SAFE Conversions');
      expect(store.save).toHaveBeenCalled();
    });

    it('should handle post-money conversion', () => {
      const result = handlers.handleConvert({
        price: '2.0',
        postMoney: true,
        date: '2025-01-01',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('handleSecurityAdd', () => {
    it('should add common stock class', () => {
      const result = handlers.handleSecurityAdd('common', 'Common Stock', '10000000', '0.0001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added security class "Common Stock"');
      expect(store.save).toHaveBeenCalled();
    });

    it('should add preferred stock class', () => {
      const result = handlers.handleSecurityAdd(
        'preferred',
        'Series A Preferred',
        '5000000',
        '0.001'
      );

      expect(result.success).toBe(true);
    });

    it('should add option pool', () => {
      const result = handlers.handleSecurityAdd('pool', 'Option Pool', '2000000');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Option Pool');
    });

    it('should handle invalid kind', () => {
      const result = handlers.handleSecurityAdd('invalid', 'Test', '1000000');

      // Should map unmapped kind and succeed
      expect(result.success).toBe(true);
    });
  });

  describe('handleSafes', () => {
    beforeEach(() => {
      const safes = [
        {
          id: 'safe_001',
          stakeholderId: 'sh_alice',
          amount: 250000,
          cap: 5000000,
          discount: 0.8,
          type: 'post',
          date: '2024-01-01',
          note: 'Seed round',
        },
        {
          id: 'safe_002',
          stakeholderId: 'sh_bob',
          amount: 100000,
          date: '2024-02-01',
        },
      ];
      mockModel.safes = safes;
      mockSAFEService.listSAFEs.mockReturnValue(safes);
      mockModel.stakeholders = [
        { id: 'sh_alice', name: 'Alice', type: 'person' },
        { id: 'sh_bob', name: 'Bob', type: 'person' },
      ];
    });

    it('should list all SAFEs with details', () => {
      const result = handlers.handleSafes();

      expect(result.success).toBe(true);
      expect(result.message).toContain('SAFEs Outstanding');
      expect(result.message).toContain('Alice');
      expect(result.message).toContain('$250,000');
      expect(result.message).toContain('Cap: $5,000,000');
      expect(result.message).toContain('Discount: 20%');
      expect(result.message).toContain('Post-money');
      expect(result.message).toContain('Seed round');
      expect(result.message).toContain('Total: $350,000 across 2 SAFEs');
    });

    it('should handle no SAFEs', () => {
      mockModel.safes = [];
      mockSAFEService.listSAFEs.mockReturnValue([]);

      const result = handlers.handleSafes();

      expect(result.success).toBe(true);
      expect(result.message).toContain('No SAFEs outstanding');
    });
  });

  describe('error handling', () => {
    it('should handle load errors gracefully', () => {
      (store.load as Mock).mockImplementation(() => {
        throw new Error('File corrupted');
      });

      const result = handlers.handleChart({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('File corrupted');
    });

    it('should handle save errors gracefully', () => {
      (store.save as Mock).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = handlers.handleStakeholder({ name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to add stakeholder');
    });
  });
});
