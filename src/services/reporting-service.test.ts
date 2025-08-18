import { describe, it, expect, beforeEach } from 'vitest';
import { ReportingService } from './reporting-service.js';
import { StakeholderService } from './stakeholder-service.js';
import { SecurityService } from './security-service.js';
import { EquityService } from './equity-service.js';
import { SAFEService } from './safe-service.js';
import { FileModel, Vesting } from '../model.js';

describe('ReportingService', () => {
  let model: FileModel;
  let service: ReportingService;
  let stakeholderService: StakeholderService;
  let securityService: SecurityService;
  let equityService: EquityService;
  let aliceId: string;
  let bobId: string;
  let commonId: string;
  let poolId: string;

  beforeEach(() => {
    model = {
      version: 1,
      company: { id: 'comp_1', name: 'Test Co' },
      stakeholders: [],
      securityClasses: [],
      issuances: [],
      optionGrants: [],
      safes: [],
      valuations: [],
      audit: [],
    };

    service = new ReportingService(model);
    stakeholderService = new StakeholderService(model);
    securityService = new SecurityService(model);
    equityService = new EquityService(model);

    aliceId = stakeholderService.addStakeholder('Alice', 'person', 'alice@test.com').id;
    bobId = stakeholderService.addStakeholder('Bob', 'person').id;
    commonId = securityService.addSecurityClass('COMMON', 'Common Stock', 10000000, 0.0001).id;
    poolId = securityService.addSecurityClass('OPTION_POOL', '2024 Plan', 2000000).id;
  });

  describe('generateCapTable', () => {
    it('should generate cap table for given date', () => {
      equityService.issueShares(commonId, aliceId, 7000000, 0.0001, '2024-01-01');
      const vesting: Vesting = { start: '2024-01-01', monthsTotal: 48, cliffMonths: 12 };
      equityService.grantOptions(bobId, 500000, 0.1, '2024-01-01', vesting);

      const result = service.generateCapTable('2025-01-01');

      expect(result.totals.issuedTotal).toBe(7000000);
      expect(result.totals.vestedOptions).toBe(125000);
      expect(result.totals.outstandingTotal).toBe(7125000);
      expect(result.rows).toHaveLength(2);
    });

    it('should use current date as default', () => {
      equityService.issueShares(commonId, aliceId, 1000000);

      const result = service.generateCapTable();

      expect(result.totals.issuedTotal).toBe(1000000);
    });
  });

  describe('exportJSON', () => {
    it('should export model as JSON string', () => {
      equityService.issueShares(commonId, aliceId, 1000000);

      const json = service.exportJSON();
      const parsed = JSON.parse(json);

      expect(parsed.company.name).toBe('Test Co');
      expect(parsed.issuances).toHaveLength(1);
      expect(parsed.stakeholders).toHaveLength(2);
    });
  });

  describe('exportCSV', () => {
    it('should export issuances and grants as CSV', () => {
      equityService.issueShares(commonId, aliceId, 1000000, 0.0001, '2024-01-01');
      equityService.grantOptions(bobId, 100000, 0.1, '2024-02-01');

      const csv = service.exportCSV();
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'stakeholder_name,stakeholder_id,type,security_class,quantity,price_per_share,date'
      );
      expect(lines[1]).toContain('Alice');
      expect(lines[1]).toContain('ISSUANCE');
      expect(lines[1]).toContain('Common Stock');
      expect(lines[2]).toContain('Bob');
      expect(lines[2]).toContain('OPTION');
    });

    it('should exclude options when requested', () => {
      equityService.issueShares(commonId, aliceId, 1000000);
      equityService.grantOptions(bobId, 100000, 0.1);

      const csv = service.exportCSV(false);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('Alice');
      expect(csv).not.toContain('Bob');
    });
  });

  describe('generateSummary', () => {
    it('should generate readable summary', () => {
      equityService.issueShares(commonId, aliceId, 7000000);
      equityService.issueShares(commonId, bobId, 1000000);
      equityService.grantOptions(bobId, 200000, 0.1);

      const summary = service.generateSummary('2024-06-01');

      expect(summary).toContain('Test Co');
      expect(summary).toContain('As of: 2024-06-01');
      expect(summary).toContain('Alice');
      expect(summary).toContain('Bob');
      expect(summary).toContain('Issued Equity:');
      expect(summary).toContain('8,000,000');
    });
  });

  describe('generateStakeholderReport', () => {
    it('should generate stakeholder report', () => {
      equityService.issueShares(commonId, aliceId, 1000000, 0.0001, '2024-01-01');
      equityService.grantOptions(aliceId, 100000, 0.1, '2024-02-01');

      const report = service.generateStakeholderReport(aliceId);

      expect(report).toContain('Alice');
      expect(report).toContain('person');
      expect(report).toContain('alice@test.com');
      expect(report).toContain('1,000,000 shares');
      expect(report).toContain('100,000 options');
    });

    it('should handle stakeholder with no holdings', () => {
      const charlieId = stakeholderService.addStakeholder('Charlie', 'person').id;

      const report = service.generateStakeholderReport(charlieId);

      expect(report).toContain('Charlie');
      expect(report).toContain('No equity holdings');
    });

    it('should throw for invalid stakeholder', () => {
      expect(() => service.generateStakeholderReport('sh_invalid')).toThrow(
        'Stakeholder with ID "sh_invalid" not found'
      );
    });
  });

  describe('generateSecurityClassReport', () => {
    it('should generate equity class report', () => {
      equityService.issueShares(commonId, aliceId, 7000000);
      equityService.issueShares(commonId, bobId, 1000000);

      const report = service.generateSecurityClassReport(commonId);

      expect(report).toContain('Common Stock');
      expect(report).toContain('COMMON');
      expect(report).toContain('Authorized: 10,000,000');
      expect(report).toContain('Issued:     8,000,000');
      expect(report).toContain('Remaining:  2,000,000');
      expect(report).toContain('Alice: 7,000,000');
      expect(report).toContain('Bob: 1,000,000');
    });

    it('should generate pool report', () => {
      equityService.grantOptions(aliceId, 500000, 0.1);
      equityService.grantOptions(bobId, 300000, 0.1);

      const report = service.generateSecurityClassReport(poolId);

      expect(report).toContain('2024 Plan');
      expect(report).toContain('OPTION_POOL');
      expect(report).toContain('Authorized: 2,000,000');
      expect(report).toContain('Granted:    800,000');
      expect(report).toContain('Remaining:  1,200,000');
      expect(report).toContain('Utilization: 40.0%');
    });

    it('should throw for invalid security class', () => {
      expect(() => service.generateSecurityClassReport('sc_invalid')).toThrow(
        'Security class with ID "sc_invalid" not found'
      );
    });
  });

  describe('complex multi-stakeholder scenarios', () => {
    it('should handle cap table with multiple security classes and stakeholders', () => {
      // Add preferred stock class
      const prefId = securityService.addSecurityClass('PREF', 'Series A', 3000000, 0.001).id;
      
      // Add more stakeholders
      const charlieId = stakeholderService.addStakeholder('Charlie VC', 'entity', 'charlie@vc.com').id;
      const dianaId = stakeholderService.addStakeholder('Diana Employee', 'person').id;
      
      // Issue different security types
      equityService.issueShares(commonId, aliceId, 3000000, 0.0001, '2024-01-01');
      equityService.issueShares(commonId, bobId, 2000000, 0.0001, '2024-01-01');
      equityService.issueShares(prefId, charlieId, 1500000, 1.0, '2024-06-01');
      
      // Grant options with different vesting
      const vesting1: Vesting = { start: '2024-01-01', monthsTotal: 48, cliffMonths: 12 };
      const vesting2: Vesting = { start: '2024-06-01', monthsTotal: 36, cliffMonths: 6 };
      equityService.grantOptions(dianaId, 200000, 0.1, '2024-01-01', vesting1);
      equityService.grantOptions(bobId, 100000, 0.2, '2024-06-01', vesting2);
      
      const capTable = service.generateCapTable('2025-01-01');
      
      expect(capTable.rows).toHaveLength(4);
      expect(capTable.totals.issuedTotal).toBe(6500000); // 3M + 2M + 1.5M
      expect(capTable.totals.vestedOptions).toBeGreaterThan(0);
      expect(capTable.totals.fd.grants).toBe(300000); // 200k + 100k
      
      // Check percentage calculations
      const aliceRow = capTable.rows.find(r => r.name === 'Alice');
      const charlieRow = capTable.rows.find(r => r.name === 'Charlie VC');
      expect(aliceRow?.outstanding).toBe(3000000);
      expect(charlieRow?.outstanding).toBe(1500000);
    });

    it('should generate summary with mixed holdings and SAFEs', () => {
      // Issue shares
      equityService.issueShares(commonId, aliceId, 5000000, 0.0001, '2024-01-01');
      
      // Add SAFEs (using SAFEService)
      const safeService = new SAFEService(model);
      safeService.addSAFE({ 
        stakeholderId: bobId, 
        amount: 100000, 
        cap: 5000000,
        discount: 0.8 
      });
      
      // Grant options
      const vesting: Vesting = { start: '2024-01-01', monthsTotal: 48, cliffMonths: 12 };
      equityService.grantOptions(aliceId, 300000, 0.1, '2024-01-01', vesting);
      
      const summary = service.generateSummary('2025-01-01');
      
      expect(summary).toContain('Alice');
      expect(summary).toContain('Bob');
      expect(summary).toContain('SAFEs (Unconverted)');
      expect(summary).toContain('100,000');
      expect(summary).toContain('Outstanding Total');
      expect(summary).toContain('Fully Diluted');
    });

    it('should export CSV with complex data correctly', () => {
      // Multiple issuances
      equityService.issueShares(commonId, aliceId, 3000000, 0.0001, '2024-01-01');
      equityService.issueShares(commonId, aliceId, 1000000, 0.0001, '2024-03-01');
      equityService.issueShares(commonId, bobId, 2000000, 0.0001, '2024-01-01');
      
      // Options
      equityService.grantOptions(aliceId, 100000, 0.1, '2024-01-01');
      equityService.grantOptions(bobId, 200000, 0.2, '2024-06-01');
      
      const csv = service.exportCSV(true);
      const lines = csv.split('\n');
      
      // Header + 3 issuances + 2 grants = 6 lines minimum
      expect(lines.length).toBeGreaterThanOrEqual(6);
      
      // Check Alice has multiple entries
      const aliceLines = lines.filter(l => l.includes('Alice'));
      expect(aliceLines.length).toBe(3); // 2 issuances + 1 grant
      
      // Verify CSV structure
      expect(lines[0]).toBe('stakeholder_name,stakeholder_id,type,security_class,quantity,price_per_share,date');
    });

    it('should handle stakeholder with no holdings in summary', () => {
      const emptyId = stakeholderService.addStakeholder('Empty Holder', 'person').id;
      
      equityService.issueShares(commonId, aliceId, 1000000, 0.0001, '2024-01-01');
      
      const summary = service.generateSummary();
      
      // Empty holder should not appear in cap table
      expect(summary).toContain('Alice');
      expect(summary).not.toContain('Empty Holder');
    });

    it('should calculate percentages correctly with multiple security classes', () => {
      const prefId = securityService.addSecurityClass('PREF', 'Series A', 5000000).id;
      
      equityService.issueShares(commonId, aliceId, 6000000, 0.0001, '2024-01-01');
      equityService.issueShares(prefId, bobId, 4000000, 1.0, '2024-06-01');
      
      const capTable = service.generateCapTable();
      
      expect(capTable.totals.issuedTotal).toBe(10000000);
      
      const aliceRow = capTable.rows.find(r => r.name === 'Alice');
      const bobRow = capTable.rows.find(r => r.name === 'Bob');
      
      expect(aliceRow?.pctOutstanding).toBeCloseTo(0.6, 2); // 60%
      expect(bobRow?.pctOutstanding).toBeCloseTo(0.4, 2); // 40%
    });

    it('should handle empty company correctly', () => {
      // Create fresh empty model
      const emptyModel: FileModel = {
        version: 1,
        company: { id: 'comp_empty', name: 'Empty Co' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };
      
      const emptyService = new ReportingService(emptyModel);
      
      const summary = emptyService.generateSummary();
      expect(summary).toContain('Empty Co');
      expect(summary).toContain('Outstanding Total:     0');
      
      const csv = emptyService.exportCSV();
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1); // Just header
      
      const capTable = emptyService.generateCapTable();
      expect(capTable.rows).toHaveLength(0);
      expect(capTable.totals.outstandingTotal).toBe(0);
    });

    it('should handle special characters in names for CSV export', () => {
      const specialId = stakeholderService.addStakeholder(
        'Alice "The Investor" O\'Brien, Jr.', 
        'person',
        'alice@test.com'
      ).id;
      
      equityService.issueShares(commonId, specialId, 1000000, 0.0001, '2024-01-01');
      
      const csv = service.exportCSV();
      const lines = csv.split('\n');
      
      // Should properly escape or handle special characters
      expect(lines[1]).toContain('Alice');
      expect(lines[1]).toContain('1000000');
    });
  });
});
