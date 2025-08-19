import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityService } from './security-service.js';
import { FileModel } from '../model.js';

describe('SecurityService', () => {
  let model: FileModel;
  let service: SecurityService;

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
    service = new SecurityService(model);
  });

  describe('addSecurityClass', () => {
    it('should add common stock class', () => {
      const sc = service.addSecurityClass('COMMON', 'Common Stock', 10000000, 0.0001);

      expect(sc.kind).toBe('COMMON');
      expect(sc.label).toBe('Common Stock');
      expect(sc.authorized).toBe(10000000);
      expect(sc.parValue).toBe(0.0001);
      expect(sc.id).toMatch(/^sc_/);
      expect(model.securityClasses).toHaveLength(1);
    });

    it('should add preferred stock class', () => {
      const sc = service.addSecurityClass('PREF', 'Series A', 5000000);

      expect(sc.kind).toBe('PREF');
      expect(sc.label).toBe('Series A');
      expect(sc.authorized).toBe(5000000);
      expect(sc.parValue).toBeUndefined();
    });

    it('should add option pool', () => {
      const sc = service.addSecurityClass('OPTION_POOL', '2024 Plan', 2000000);

      expect(sc.kind).toBe('OPTION_POOL');
      expect(sc.label).toBe('2024 Plan');
      expect(sc.authorized).toBe(2000000);
    });

    it('should prevent duplicate labels', () => {
      service.addSecurityClass('COMMON', 'Common Stock', 10000000);

      expect(() => service.addSecurityClass('PREF', 'Common Stock', 5000000)).toThrow(
        'Security class "Common Stock" already exists'
      );
    });

    it('should validate authorized is positive', () => {
      expect(() => service.addSecurityClass('COMMON', 'Common', -100)).toThrow();
      expect(() => service.addSecurityClass('COMMON', 'Common', 0)).toThrow();
    });
  });

  describe('getSecurityClass', () => {
    it('should find security class by ID', () => {
      const added = service.addSecurityClass('COMMON', 'Common', 10000000);
      const found = service.getSecurityClass(added.id);

      expect(found).toEqual(added);
    });

    it('should return undefined for missing ID', () => {
      expect(service.getSecurityClass('sc_missing')).toBeUndefined();
    });
  });

  describe('getSecurityClassByLabel', () => {
    it('should find security class by label', () => {
      const added = service.addSecurityClass('COMMON', 'Common Stock', 10000000);
      const found = service.getSecurityClassByLabel('Common Stock');

      expect(found).toEqual(added);
    });

    it('should return undefined for missing label', () => {
      expect(service.getSecurityClassByLabel('Missing')).toBeUndefined();
    });
  });

  describe('listByKind', () => {
    it('should filter by kind', () => {
      service.addSecurityClass('COMMON', 'Common', 10000000);
      service.addSecurityClass('PREF', 'Series A', 5000000);
      service.addSecurityClass('PREF', 'Series B', 3000000);
      service.addSecurityClass('OPTION_POOL', 'Plan', 2000000);

      expect(service.listByKind('PREF')).toHaveLength(2);
      expect(service.listByKind('COMMON')).toHaveLength(1);
      expect(service.listByKind('OPTION_POOL')).toHaveLength(1);
    });
  });

  describe('validatePoolCapacity', () => {
    it('should calculate pool capacity', () => {
      const pool = service.addSecurityClass('OPTION_POOL', '2024 Plan', 2000000);
      model.optionGrants.push({
        id: 'og_1',
        stakeholderId: 'sh_1',
        qty: 500000,
        exercise: 0.1,
        grantDate: '2024-01-01',
      });

      const capacity = service.validatePoolCapacity();

      expect(capacity.authorized).toBe(2000000);
      expect(capacity.granted).toBe(500000);
      expect(capacity.remaining).toBe(1500000);
    });

    it('should calculate specific pool capacity', () => {
      const pool1 = service.addSecurityClass('OPTION_POOL', 'Plan 1', 1000000);
      const pool2 = service.addSecurityClass('OPTION_POOL', 'Plan 2', 2000000);

      const capacity = service.validatePoolCapacity(pool1.id);

      expect(capacity.authorized).toBe(1000000);
      expect(capacity.granted).toBe(0);
      expect(capacity.remaining).toBe(1000000);
    });

    it('should throw for invalid pool ID', () => {
      expect(() => service.validatePoolCapacity('sc_invalid')).toThrow(
        'Option pool with ID "sc_invalid" not found'
      );
    });

    it('should handle over-granted pools', () => {
      service.addSecurityClass('OPTION_POOL', 'Small Pool', 100000);
      model.optionGrants.push({
        id: 'og_1',
        stakeholderId: 'sh_1',
        qty: 200000,
        exercise: 0.1,
        grantDate: '2024-01-01',
      });

      const capacity = service.validatePoolCapacity();

      expect(capacity.authorized).toBe(100000);
      expect(capacity.granted).toBe(200000);
      expect(capacity.remaining).toBe(0);
    });
  });

  describe('getIssuedByClass', () => {
    it('should sum issuances for class', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);
      model.issuances.push(
        {
          id: 'is_1',
          securityClassId: common.id,
          stakeholderId: 'sh_1',
          qty: 1000000,
          date: '2024-01-01',
        },
        {
          id: 'is_2',
          securityClassId: common.id,
          stakeholderId: 'sh_2',
          qty: 500000,
          date: '2024-01-01',
        }
      );

      expect(service.getIssuedByClass(common.id)).toBe(1500000);
    });

    it('should return 0 for no issuances', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);

      expect(service.getIssuedByClass(common.id)).toBe(0);
    });
  });

  describe('getRemainingAuthorized', () => {
    it('should calculate remaining for equity class', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);
      model.issuances.push({
        id: 'is_1',
        securityClassId: common.id,
        stakeholderId: 'sh_1',
        qty: 7000000,
        date: '2024-01-01',
      });

      expect(service.getRemainingAuthorized(common.id)).toBe(3000000);
    });

    it('should calculate remaining for option pool', () => {
      const pool = service.addSecurityClass('OPTION_POOL', 'Plan', 2000000);
      model.optionGrants.push({
        id: 'og_1',
        stakeholderId: 'sh_1',
        qty: 500000,
        exercise: 0.1,
        grantDate: '2024-01-01',
      });

      expect(service.getRemainingAuthorized(pool.id)).toBe(1500000);
    });

    it('should throw for invalid ID', () => {
      expect(() => service.getRemainingAuthorized('sc_invalid')).toThrow(
        'Security class with ID "sc_invalid" not found'
      );
    });
  });

  describe('updateAuthorized', () => {
    it('should update authorized shares', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);
      const updated = service.updateAuthorized(common.id, 15000000);

      expect(updated.authorized).toBe(15000000);
      expect(model.securityClasses[0].authorized).toBe(15000000);
    });

    it('should prevent reducing below issued', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);
      model.issuances.push({
        id: 'is_1',
        securityClassId: common.id,
        stakeholderId: 'sh_1',
        qty: 7000000,
        date: '2024-01-01',
      });

      expect(() => service.updateAuthorized(common.id, 5000000)).toThrow(
        'Cannot reduce authorized to 5000000 - already issued 7000000 shares'
      );
    });

    it('should prevent reducing pool below granted', () => {
      const pool = service.addSecurityClass('OPTION_POOL', 'Plan', 2000000);
      model.optionGrants.push({
        id: 'og_1',
        stakeholderId: 'sh_1',
        qty: 1500000,
        exercise: 0.1,
        grantDate: '2024-01-01',
      });

      expect(() => service.updateAuthorized(pool.id, 1000000)).toThrow(
        'Cannot reduce authorized to 1000000 - already granted 1500000 options'
      );
    });
  });

  describe('removeSecurityClass', () => {
    it('should remove unused security class', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);
      service.removeSecurityClass(common.id);

      expect(model.securityClasses).toHaveLength(0);
    });

    it('should prevent removal with issuances', () => {
      const common = service.addSecurityClass('COMMON', 'Common', 10000000);
      model.issuances.push({
        id: 'is_1',
        securityClassId: common.id,
        stakeholderId: 'sh_1',
        qty: 1000000,
        date: '2024-01-01',
      });

      expect(() => service.removeSecurityClass(common.id)).toThrow(
        `Cannot remove security class "${common.id}" - has existing issuances`
      );
    });

    it('should prevent removal of pool with grants', () => {
      const pool = service.addSecurityClass('OPTION_POOL', 'Plan', 2000000);
      model.optionGrants.push({
        id: 'og_1',
        stakeholderId: 'sh_1',
        qty: 500000,
        exercise: 0.1,
        grantDate: '2024-01-01',
      });

      expect(() => service.removeSecurityClass(pool.id)).toThrow(
        `Cannot remove option pool "${pool.id}" - has 500000 granted options`
      );
    });

    it('should throw for missing security class', () => {
      expect(() => service.removeSecurityClass('sc_missing')).toThrow(
        'Security class with ID "sc_missing" not found'
      );
    });
  });

  describe('updateAuthorized edge cases', () => {
    it('should throw error when security class not found', () => {
      expect(() => service.updateAuthorized('non-existent-id', 10000000)).toThrow(
        'Security class with ID "non-existent-id" not found'
      );
    });
  });

  describe('listSecurityClasses', () => {
    it('should return all security classes', () => {
      const common = service.addSecurityClass('COMMON', 'Common Stock', 10000000);
      const preferred = service.addSecurityClass('PREF', 'Preferred Stock', 5000000);
      const pool = service.addSecurityClass('OPTION_POOL', 'Option Pool', 2000000);

      const classes = service.listSecurityClasses();

      expect(classes).toHaveLength(3);
      expect(classes[0].id).toBe(common.id);
      expect(classes[1].id).toBe(preferred.id);
      expect(classes[2].id).toBe(pool.id);
    });

    it('should return empty array when no security classes', () => {
      // Start with fresh model
      model.securityClasses = [];
      const classes = service.listSecurityClasses();
      expect(classes).toEqual([]);
    });

    it('should return a copy of the array', () => {
      service.addSecurityClass('COMMON', 'Common Stock', 10000000);
      const classes1 = service.listSecurityClasses();
      const classes2 = service.listSecurityClasses();

      // Should be different array instances
      expect(classes1).not.toBe(classes2);
      // But have same content
      expect(classes1).toEqual(classes2);
    });
  });
});
