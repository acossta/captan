import { describe, it, expect, beforeEach } from 'vitest';
import { ReportingService } from './reporting-service.js';
import { StakeholderService } from './stakeholder-service.js';
import { SecurityService } from './security-service.js';
import { EquityService } from './equity-service.js';
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
      valuations: [],
      audit: []
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
      equityService.grantOptions(bobId, 500000, 0.10, '2024-01-01', vesting);
      
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
      equityService.grantOptions(bobId, 100000, 0.10, '2024-02-01');
      
      const csv = service.exportCSV();
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('stakeholder_name,stakeholder_id,type,security_class,quantity,price_per_share,date');
      expect(lines[1]).toContain('Alice');
      expect(lines[1]).toContain('ISSUANCE');
      expect(lines[1]).toContain('Common Stock');
      expect(lines[2]).toContain('Bob');
      expect(lines[2]).toContain('OPTION');
    });

    it('should exclude options when requested', () => {
      equityService.issueShares(commonId, aliceId, 1000000);
      equityService.grantOptions(bobId, 100000, 0.10);
      
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
      equityService.grantOptions(bobId, 200000, 0.10);
      
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
      equityService.grantOptions(aliceId, 100000, 0.10, '2024-02-01');
      
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
      equityService.grantOptions(aliceId, 500000, 0.10);
      equityService.grantOptions(bobId, 300000, 0.10);
      
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
});