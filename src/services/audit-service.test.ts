import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from './audit-service.js';
import { FileModel } from '../model.js';

describe('AuditService', () => {
  let model: FileModel;
  let service: AuditService;

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
    service = new AuditService(model);
  });

  describe('logAction', () => {
    it('should add audit entry', () => {
      const entry = service.logAction('TEST_ACTION', { foo: 'bar' });
      
      expect(entry.action).toBe('TEST_ACTION');
      expect(entry.data).toEqual({ foo: 'bar' });
      expect(entry.by).toBe('cli');
      expect(entry.ts).toBeDefined();
      expect(model.audit).toHaveLength(1);
    });

    it('should use custom actor', () => {
      const entry = service.logAction('TEST', {}, 'user123');
      
      expect(entry.by).toBe('user123');
    });

    it('should validate entry with schema', () => {
      const entry = service.logAction('VALID', { nested: { data: true } });
      
      expect(entry.action).toBe('VALID');
      expect(entry.data.nested.data).toBe(true);
    });
  });

  describe('getAuditTrail', () => {
    it('should return all audit entries', () => {
      service.logAction('ACTION1', {});
      service.logAction('ACTION2', {});
      service.logAction('ACTION3', {});
      
      const trail = service.getAuditTrail();
      
      expect(trail).toHaveLength(3);
      expect(trail[0].action).toBe('ACTION1');
      expect(trail[2].action).toBe('ACTION3');
    });

    it('should return copy of array', () => {
      service.logAction('TEST', {});
      
      const trail1 = service.getAuditTrail();
      const trail2 = service.getAuditTrail();
      
      expect(trail1).not.toBe(trail2);
      expect(trail1).toEqual(trail2);
    });
  });

  describe('getAuditByAction', () => {
    it('should filter by action', () => {
      service.logAction('CREATE', { id: 1 });
      service.logAction('UPDATE', { id: 2 });
      service.logAction('CREATE', { id: 3 });
      service.logAction('DELETE', { id: 4 });
      
      const creates = service.getAuditByAction('CREATE');
      
      expect(creates).toHaveLength(2);
      expect(creates[0].data.id).toBe(1);
      expect(creates[1].data.id).toBe(3);
    });
  });

  describe('getAuditByActor', () => {
    it('should filter by actor', () => {
      service.logAction('ACTION1', {}, 'alice');
      service.logAction('ACTION2', {}, 'bob');
      service.logAction('ACTION3', {}, 'alice');
      
      const aliceActions = service.getAuditByActor('alice');
      
      expect(aliceActions).toHaveLength(2);
      expect(aliceActions[0].action).toBe('ACTION1');
      expect(aliceActions[1].action).toBe('ACTION3');
    });
  });

  describe('filterByDateRange', () => {
    it('should filter entries by date range', () => {
      model.audit = [
        { ts: '2024-01-01T00:00:00Z', by: 'cli', action: 'EARLY', data: {} },
        { ts: '2024-06-15T00:00:00Z', by: 'cli', action: 'MIDDLE', data: {} },
        { ts: '2024-12-31T00:00:00Z', by: 'cli', action: 'LATE', data: {} }
      ];
      
      const filtered = service.filterByDateRange('2024-05-01', '2024-07-01');
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].action).toBe('MIDDLE');
    });

    it('should include boundary dates', () => {
      model.audit = [
        { ts: '2024-01-01T00:00:00Z', by: 'cli', action: 'START', data: {} },
        { ts: '2024-01-31T23:59:59Z', by: 'cli', action: 'END', data: {} }
      ];
      
      const filtered = service.filterByDateRange('2024-01-01', '2024-02-01');
      
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getRecentActions', () => {
    it('should return recent actions in reverse order', () => {
      for (let i = 1; i <= 20; i++) {
        service.logAction(`ACTION${i}`, { num: i });
      }
      
      const recent = service.getRecentActions(5);
      
      expect(recent).toHaveLength(5);
      expect(recent[0].action).toBe('ACTION20');
      expect(recent[4].action).toBe('ACTION16');
    });

    it('should use default limit of 10', () => {
      for (let i = 1; i <= 15; i++) {
        service.logAction(`ACTION${i}`, {});
      }
      
      const recent = service.getRecentActions();
      
      expect(recent).toHaveLength(10);
    });
  });

  describe('searchAudit', () => {
    it('should search in action names', () => {
      service.logAction('CREATE_USER', {});
      service.logAction('DELETE_USER', {});
      service.logAction('UPDATE_ROLE', {});
      
      const results = service.searchAudit('USER');
      
      expect(results).toHaveLength(2);
    });

    it('should search in data', () => {
      service.logAction('ACTION1', { name: 'Alice' });
      service.logAction('ACTION2', { name: 'Bob' });
      service.logAction('ACTION3', { name: 'Charlie' });
      
      const results = service.searchAudit('bob');
      
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('ACTION2');
    });

    it('should search in actor field', () => {
      service.logAction('ACTION1', {}, 'admin');
      service.logAction('ACTION2', {}, 'user');
      service.logAction('ACTION3', {}, 'admin');
      
      const results = service.searchAudit('admin');
      
      expect(results).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      service.logAction('CREATE', { value: 'TEST' });
      
      expect(service.searchAudit('create')).toHaveLength(1);
      expect(service.searchAudit('CREATE')).toHaveLength(1);
      expect(service.searchAudit('test')).toHaveLength(1);
    });
  });

  describe('clearAuditTrail', () => {
    it('should remove all audit entries', () => {
      service.logAction('ACTION1', {});
      service.logAction('ACTION2', {});
      
      expect(model.audit).toHaveLength(2);
      
      service.clearAuditTrail();
      
      expect(model.audit).toHaveLength(0);
    });
  });

  describe('exportAuditLog', () => {
    beforeEach(() => {
      service.logAction('CREATE', { id: 1 }, 'alice');
      service.logAction('UPDATE', { id: 1, name: 'Test' }, 'bob');
    });

    it('should export as text format', () => {
      const text = service.exportAuditLog('text');
      
      expect(text).toContain('Audit Trail');
      expect(text).toContain('CREATE');
      expect(text).toContain('By: alice');
      expect(text).toContain('UPDATE');
      expect(text).toContain('By: bob');
    });

    it('should export as JSON format', () => {
      const json = service.exportAuditLog('json');
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0].action).toBe('CREATE');
      expect(parsed[1].action).toBe('UPDATE');
    });

    it('should default to text format', () => {
      const output = service.exportAuditLog();
      
      expect(output).toContain('Audit Trail');
    });
  });

  describe('getAuditSummary', () => {
    it('should return summary statistics', () => {
      service.logAction('CREATE', {}, 'alice');
      service.logAction('UPDATE', {}, 'bob');
      service.logAction('CREATE', {}, 'alice');
      service.logAction('DELETE', {}, 'alice');
      
      const summary = service.getAuditSummary();
      
      expect(summary.totalEntries).toBe(4);
      expect(summary.uniqueActions).toHaveLength(3);
      expect(summary.uniqueActions).toContain('CREATE');
      expect(summary.uniqueActions).toContain('UPDATE');
      expect(summary.uniqueActions).toContain('DELETE');
      expect(summary.uniqueActors).toEqual(['alice', 'bob']);
      expect(summary.actionCounts.CREATE).toBe(2);
      expect(summary.actionCounts.UPDATE).toBe(1);
      expect(summary.actionCounts.DELETE).toBe(1);
    });

    it('should handle empty audit trail', () => {
      const summary = service.getAuditSummary();
      
      expect(summary.totalEntries).toBe(0);
      expect(summary.uniqueActions).toEqual([]);
      expect(summary.uniqueActors).toEqual([]);
      expect(summary.dateRange.from).toBeNull();
      expect(summary.dateRange.to).toBeNull();
      expect(summary.actionCounts).toEqual({});
    });

    it('should find date range', () => {
      model.audit = [
        { ts: '2024-01-01T00:00:00Z', by: 'cli', action: 'EARLY', data: {} },
        { ts: '2024-12-31T23:59:59Z', by: 'cli', action: 'LATE', data: {} },
        { ts: '2024-06-15T12:00:00Z', by: 'cli', action: 'MIDDLE', data: {} }
      ];
      
      const summary = service.getAuditSummary();
      
      expect(summary.dateRange.from).toBe('2024-01-01T00:00:00Z');
      expect(summary.dateRange.to).toBe('2024-12-31T23:59:59Z');
    });
  });
});