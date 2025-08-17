import { describe, it, expect, beforeEach } from 'vitest';
import { EquityService } from './equity-service.js';
import { StakeholderService } from './stakeholder-service.js';
import { SecurityService } from './security-service.js';
import { FileModel, Vesting } from '../model.js';

describe('EquityService', () => {
  let model: FileModel;
  let service: EquityService;
  let stakeholderService: StakeholderService;
  let securityService: SecurityService;
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
      audit: [],
    };

    service = new EquityService(model);
    stakeholderService = new StakeholderService(model);
    securityService = new SecurityService(model);

    aliceId = stakeholderService.addStakeholder('Alice', 'person').id;
    bobId = stakeholderService.addStakeholder('Bob', 'person').id;
    commonId = securityService.addSecurityClass('COMMON', 'Common', 10000000).id;
    poolId = securityService.addSecurityClass('OPTION_POOL', 'Plan', 2000000).id;
  });

  describe('issueShares', () => {
    it('should issue shares to stakeholder', () => {
      const issuance = service.issueShares(commonId, aliceId, 1000000, 0.0001, '2024-01-01');

      expect(issuance.securityClassId).toBe(commonId);
      expect(issuance.stakeholderId).toBe(aliceId);
      expect(issuance.qty).toBe(1000000);
      expect(issuance.pps).toBe(0.0001);
      expect(issuance.date).toBe('2024-01-01');
      expect(issuance.id).toMatch(/^is_/);
      expect(model.issuances).toHaveLength(1);
    });

    it('should use defaults for optional parameters', () => {
      const issuance = service.issueShares(commonId, aliceId, 1000000);

      expect(issuance.pps).toBe(0);
      expect(issuance.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(issuance.cert).toBeUndefined();
    });

    it('should prevent issuing from option pool', () => {
      expect(() => service.issueShares(poolId, aliceId, 100000)).toThrow(
        'Cannot issue shares from an option pool - use grantOptions instead'
      );
    });

    it('should enforce authorized limit', () => {
      service.issueShares(commonId, aliceId, 9000000);

      expect(() => service.issueShares(commonId, bobId, 2000000)).toThrow(
        'Cannot issue 2000000 shares - only 1000000 authorized shares remaining for "Common"'
      );
    });

    it('should validate stakeholder exists', () => {
      expect(() => service.issueShares(commonId, 'sh_invalid', 100000)).toThrow(
        'Stakeholder with ID "sh_invalid" not found'
      );
    });

    it('should validate security class exists', () => {
      expect(() => service.issueShares('sc_invalid', aliceId, 100000)).toThrow(
        'Security class with ID "sc_invalid" not found'
      );
    });
  });

  describe('grantOptions', () => {
    it('should grant options to stakeholder', () => {
      const vesting: Vesting = {
        start: '2024-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      const grant = service.grantOptions(aliceId, 100000, 0.1, '2024-01-01', vesting);

      expect(grant.stakeholderId).toBe(aliceId);
      expect(grant.qty).toBe(100000);
      expect(grant.exercise).toBe(0.1);
      expect(grant.grantDate).toBe('2024-01-01');
      expect(grant.vesting).toEqual(vesting);
      expect(grant.id).toMatch(/^og_/);
      expect(model.optionGrants).toHaveLength(1);
    });

    it('should enforce pool capacity', () => {
      service.grantOptions(aliceId, 1500000, 0.1);

      expect(() => service.grantOptions(bobId, 600000, 0.1)).toThrow(
        'Cannot grant 600000 options - only 500000 options remaining in pool'
      );
    });

    it('should work without vesting', () => {
      const grant = service.grantOptions(aliceId, 100000, 0.1);

      expect(grant.vesting).toBeUndefined();
    });

    it('should validate stakeholder exists', () => {
      expect(() => service.grantOptions('sh_invalid', 100000, 0.1)).toThrow(
        'Stakeholder with ID "sh_invalid" not found'
      );
    });
  });

  describe('getIssuancesByStakeholder', () => {
    it('should return all issuances for stakeholder', () => {
      service.issueShares(commonId, aliceId, 1000000);
      service.issueShares(commonId, aliceId, 500000);
      service.issueShares(commonId, bobId, 300000);

      const aliceIssuances = service.getIssuancesByStakeholder(aliceId);

      expect(aliceIssuances).toHaveLength(2);
      expect(aliceIssuances[0].qty).toBe(1000000);
      expect(aliceIssuances[1].qty).toBe(500000);
    });
  });

  describe('getGrantsByStakeholder', () => {
    it('should return all grants for stakeholder', () => {
      service.grantOptions(aliceId, 100000, 0.1);
      service.grantOptions(aliceId, 50000, 0.15);
      service.grantOptions(bobId, 30000, 0.1);

      const aliceGrants = service.getGrantsByStakeholder(aliceId);

      expect(aliceGrants).toHaveLength(2);
      expect(aliceGrants[0].qty).toBe(100000);
      expect(aliceGrants[1].qty).toBe(50000);
    });
  });

  describe('transferShares', () => {
    it('should transfer full issuance', () => {
      const issuance = service.issueShares(commonId, aliceId, 1000000);

      const result = service.transferShares(issuance.id, bobId);

      expect(result.to.stakeholderId).toBe(bobId);
      expect(result.to.qty).toBe(1000000);
      expect(model.issuances).toHaveLength(1);
    });

    it('should transfer partial issuance', () => {
      const issuance = service.issueShares(commonId, aliceId, 1000000);

      const result = service.transferShares(issuance.id, bobId, 300000);

      expect(result.from.qty).toBe(700000);
      expect(result.to.qty).toBe(300000);
      expect(result.to.stakeholderId).toBe(bobId);
      expect(model.issuances).toHaveLength(2);
    });

    it('should prevent transferring more than available', () => {
      const issuance = service.issueShares(commonId, aliceId, 1000000);

      expect(() => service.transferShares(issuance.id, bobId, 2000000)).toThrow(
        'Cannot transfer 2000000 shares - issuance only has 1000000 shares'
      );
    });

    it('should validate issuance exists', () => {
      expect(() => service.transferShares('is_invalid', bobId)).toThrow(
        'Issuance with ID "is_invalid" not found'
      );
    });
  });

  describe('cancelIssuance', () => {
    it('should remove issuance', () => {
      const issuance = service.issueShares(commonId, aliceId, 1000000);

      service.cancelIssuance(issuance.id);

      expect(model.issuances).toHaveLength(0);
    });

    it('should throw for invalid ID', () => {
      expect(() => service.cancelIssuance('is_invalid')).toThrow(
        'Issuance with ID "is_invalid" not found'
      );
    });
  });

  describe('cancelGrant', () => {
    it('should remove grant', () => {
      const grant = service.grantOptions(aliceId, 100000, 0.1);

      service.cancelGrant(grant.id);

      expect(model.optionGrants).toHaveLength(0);
    });

    it('should throw for invalid ID', () => {
      expect(() => service.cancelGrant('og_invalid')).toThrow(
        'Grant with ID "og_invalid" not found'
      );
    });
  });

  describe('exerciseOptions', () => {
    it('should exercise full grant', () => {
      const grant = service.grantOptions(aliceId, 100000, 0.1);

      const issuance = service.exerciseOptions(grant.id, 100000, '2025-01-01');

      expect(issuance.qty).toBe(100000);
      expect(issuance.pps).toBe(0.1);
      expect(issuance.stakeholderId).toBe(aliceId);
      expect(model.optionGrants).toHaveLength(0);
      expect(model.issuances).toHaveLength(1);
    });

    it('should exercise partial grant', () => {
      const grant = service.grantOptions(aliceId, 100000, 0.1);

      const issuance = service.exerciseOptions(grant.id, 30000);

      expect(issuance.qty).toBe(30000);
      expect(model.optionGrants[0].qty).toBe(70000);
      expect(model.issuances).toHaveLength(1);
    });

    it('should prevent exercising more than granted', () => {
      const grant = service.grantOptions(aliceId, 100000, 0.1);

      expect(() => service.exerciseOptions(grant.id, 200000)).toThrow(
        'Cannot exercise 200000 options - grant only has 100000 options'
      );
    });

    it('should throw if no common stock class', () => {
      model.securityClasses = model.securityClasses.filter((sc) => sc.kind !== 'COMMON');
      const grant = service.grantOptions(aliceId, 100000, 0.1);

      expect(() => service.exerciseOptions(grant.id, 50000)).toThrow(
        'No common stock class found for option exercise'
      );
    });
  });
});
