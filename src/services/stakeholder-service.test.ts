import { describe, it, expect, beforeEach } from 'vitest';
import { StakeholderService } from './stakeholder-service.js';
import { FileModel } from '../model.js';

describe('StakeholderService', () => {
  let model: FileModel;
  let service: StakeholderService;

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
    service = new StakeholderService(model);
  });

  describe('addStakeholder', () => {
    it('should add a person stakeholder', () => {
      const stakeholder = service.addStakeholder('Alice', 'person', 'alice@test.com');

      expect(stakeholder.name).toBe('Alice');
      expect(stakeholder.type).toBe('person');
      expect(stakeholder.email).toBe('alice@test.com');
      expect(stakeholder.id).toMatch(/^sh_/);
      expect(model.stakeholders).toHaveLength(1);
    });

    it('should add an entity stakeholder', () => {
      const stakeholder = service.addStakeholder('Acme Corp', 'entity');

      expect(stakeholder.name).toBe('Acme Corp');
      expect(stakeholder.type).toBe('entity');
      expect(stakeholder.email).toBeUndefined();
    });

    it('should prevent duplicate stakeholders', () => {
      service.addStakeholder('Alice', 'person');

      expect(() => service.addStakeholder('Alice', 'person')).toThrow(
        'Stakeholder "Alice" of type "person" already exists'
      );
    });

    it('should allow same name with different type', () => {
      service.addStakeholder('Alice', 'person');
      const entity = service.addStakeholder('Alice', 'entity');

      expect(model.stakeholders).toHaveLength(2);
      expect(entity.type).toBe('entity');
    });

    it('should validate email format', () => {
      expect(() => service.addStakeholder('Bob', 'person', 'invalid-email')).toThrow();
    });
  });

  describe('getStakeholder', () => {
    it('should find stakeholder by ID', () => {
      const added = service.addStakeholder('Alice', 'person');
      const found = service.getStakeholder(added.id);

      expect(found).toEqual(added);
    });

    it('should return undefined for missing ID', () => {
      expect(service.getStakeholder('sh_missing')).toBeUndefined();
    });
  });

  describe('getStakeholderByName', () => {
    it('should find stakeholder by name', () => {
      const added = service.addStakeholder('Alice', 'person');
      const found = service.getStakeholderByName('Alice');

      expect(found).toEqual(added);
    });

    it('should return undefined for missing name', () => {
      expect(service.getStakeholderByName('Missing')).toBeUndefined();
    });
  });

  describe('listStakeholders', () => {
    it('should return all stakeholders', () => {
      service.addStakeholder('Alice', 'person');
      service.addStakeholder('Bob', 'person');
      service.addStakeholder('Acme', 'entity');

      const list = service.listStakeholders();

      expect(list).toHaveLength(3);
      expect(list.map((s) => s.name)).toEqual(['Alice', 'Bob', 'Acme']);
    });

    it('should return copy of array', () => {
      service.addStakeholder('Alice', 'person');

      const list1 = service.listStakeholders();
      const list2 = service.listStakeholders();

      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });

  describe('validateStakeholderExists', () => {
    it('should not throw for existing stakeholder', () => {
      const added = service.addStakeholder('Alice', 'person');

      expect(() => service.validateStakeholderExists(added.id)).not.toThrow();
    });

    it('should throw for missing stakeholder', () => {
      expect(() => service.validateStakeholderExists('sh_missing')).toThrow(
        'Stakeholder with ID "sh_missing" not found'
      );
    });
  });

  describe('updateStakeholder', () => {
    it('should update stakeholder fields', () => {
      const added = service.addStakeholder('Alice', 'person');
      const updated = service.updateStakeholder(added.id, {
        email: 'newemail@test.com',
      });

      expect(updated.email).toBe('newemail@test.com');
      expect(updated.name).toBe('Alice');
      expect(model.stakeholders[0].email).toBe('newemail@test.com');
    });

    it('should throw for missing stakeholder', () => {
      expect(() => service.updateStakeholder('sh_missing', { name: 'New' })).toThrow(
        'Stakeholder with ID "sh_missing" not found'
      );
    });

    it('should validate updated data', () => {
      const added = service.addStakeholder('Alice', 'person');

      expect(() => service.updateStakeholder(added.id, { email: 'invalid' })).toThrow();
    });
  });

  describe('removeStakeholder', () => {
    it('should remove stakeholder without holdings', () => {
      const added = service.addStakeholder('Alice', 'person');
      service.removeStakeholder(added.id);

      expect(model.stakeholders).toHaveLength(0);
    });

    it('should prevent removal with issuances', () => {
      const added = service.addStakeholder('Alice', 'person');
      model.issuances.push({
        id: 'is_1',
        securityClassId: 'sc_1',
        stakeholderId: added.id,
        qty: 1000,
        date: '2024-01-01',
      });

      expect(() => service.removeStakeholder(added.id)).toThrow(
        `Cannot remove stakeholder "${added.id}" - has existing issuances or grants`
      );
    });

    it('should prevent removal with grants', () => {
      const added = service.addStakeholder('Alice', 'person');
      model.optionGrants.push({
        id: 'og_1',
        stakeholderId: added.id,
        qty: 1000,
        exercise: 0.1,
        grantDate: '2024-01-01',
      });

      expect(() => service.removeStakeholder(added.id)).toThrow(
        `Cannot remove stakeholder "${added.id}" - has existing issuances or grants`
      );
    });

    it('should throw for missing stakeholder', () => {
      expect(() => service.removeStakeholder('sh_missing')).toThrow(
        'Stakeholder with ID "sh_missing" not found'
      );
    });
  });
});
