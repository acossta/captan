import { FileModel, AuditEntry, AuditEntrySchema } from '../model.js';

export class AuditService {
  constructor(private model: FileModel) {}

  logAction(action: string, data: any, by = 'cli'): AuditEntry {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      by,
      action,
      data
    };

    const validated = AuditEntrySchema.parse(entry);
    this.model.audit.push(validated);
    return validated;
  }

  getAuditTrail(): AuditEntry[] {
    return [...this.model.audit];
  }

  getAuditByAction(action: string): AuditEntry[] {
    return this.model.audit.filter(entry => entry.action === action);
  }

  getAuditByActor(by: string): AuditEntry[] {
    return this.model.audit.filter(entry => entry.by === by);
  }

  filterByDateRange(from: string, to: string): AuditEntry[] {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    return this.model.audit.filter(entry => {
      const entryDate = new Date(entry.ts);
      return entryDate >= fromDate && entryDate <= toDate;
    });
  }

  getRecentActions(limit = 10): AuditEntry[] {
    return this.model.audit
      .slice(-limit)
      .reverse();
  }

  searchAudit(searchTerm: string): AuditEntry[] {
    const term = searchTerm.toLowerCase();
    
    return this.model.audit.filter(entry => {
      const actionMatch = entry.action.toLowerCase().includes(term);
      const dataMatch = JSON.stringify(entry.data).toLowerCase().includes(term);
      const byMatch = entry.by.toLowerCase().includes(term);
      
      return actionMatch || dataMatch || byMatch;
    });
  }

  clearAuditTrail(): void {
    this.model.audit = [];
  }

  exportAuditLog(format: 'json' | 'text' = 'text'): string {
    if (format === 'json') {
      return JSON.stringify(this.model.audit, null, 2);
    }

    const lines: string[] = ['Audit Trail', '===========', ''];
    
    for (const entry of this.model.audit) {
      lines.push(`[${entry.ts}] ${entry.action}`);
      lines.push(`  By: ${entry.by}`);
      if (entry.data && Object.keys(entry.data).length > 0) {
        lines.push(`  Data: ${JSON.stringify(entry.data)}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  getAuditSummary(): {
    totalEntries: number;
    uniqueActions: string[];
    uniqueActors: string[];
    dateRange: { from: string | null; to: string | null };
    actionCounts: Record<string, number>;
  } {
    const totalEntries = this.model.audit.length;
    
    if (totalEntries === 0) {
      return {
        totalEntries: 0,
        uniqueActions: [],
        uniqueActors: [],
        dateRange: { from: null, to: null },
        actionCounts: {}
      };
    }

    const actions = new Set<string>();
    const actors = new Set<string>();
    const actionCounts: Record<string, number> = {};
    
    let earliestDate = this.model.audit[0].ts;
    let latestDate = this.model.audit[0].ts;
    
    for (const entry of this.model.audit) {
      actions.add(entry.action);
      actors.add(entry.by);
      
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      
      if (entry.ts < earliestDate) earliestDate = entry.ts;
      if (entry.ts > latestDate) latestDate = entry.ts;
    }
    
    return {
      totalEntries,
      uniqueActions: Array.from(actions),
      uniqueActors: Array.from(actors),
      dateRange: { from: earliestDate, to: latestDate },
      actionCounts
    };
  }
}