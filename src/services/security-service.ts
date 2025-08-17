import { randomUUID } from 'node:crypto';
import { FileModel, SecurityClass, SecurityClassSchema, Kind } from '../model.js';

export class SecurityService {
  constructor(private model: FileModel) {}

  addSecurityClass(
    kind: Kind,
    label: string,
    authorized: number,
    parValue?: number
  ): SecurityClass {
    const securityClass: SecurityClass = {
      id: `sc_${randomUUID()}`,
      kind,
      label,
      authorized,
      parValue
    };

    const validated = SecurityClassSchema.parse(securityClass);
    
    if (this.model.securityClasses.some(sc => sc.label === label)) {
      throw new Error(`Security class "${label}" already exists`);
    }

    this.model.securityClasses.push(validated);
    return validated;
  }

  getSecurityClass(id: string): SecurityClass | undefined {
    return this.model.securityClasses.find(sc => sc.id === id);
  }

  getSecurityClassByLabel(label: string): SecurityClass | undefined {
    return this.model.securityClasses.find(sc => sc.label === label);
  }

  listSecurityClasses(): SecurityClass[] {
    return [...this.model.securityClasses];
  }

  listByKind(kind: Kind): SecurityClass[] {
    return this.model.securityClasses.filter(sc => sc.kind === kind);
  }

  validateSecurityClassExists(id: string): void {
    if (!this.getSecurityClass(id)) {
      throw new Error(`Security class with ID "${id}" not found`);
    }
  }

  validatePoolCapacity(poolId?: string): {
    authorized: number;
    granted: number;
    remaining: number;
  } {
    const pools = poolId 
      ? this.model.securityClasses.filter(sc => sc.id === poolId && sc.kind === 'OPTION_POOL')
      : this.model.securityClasses.filter(sc => sc.kind === 'OPTION_POOL');

    if (poolId && pools.length === 0) {
      throw new Error(`Option pool with ID "${poolId}" not found`);
    }

    const authorized = pools.reduce((sum, pool) => sum + pool.authorized, 0);
    const granted = this.model.optionGrants.reduce((sum, grant) => sum + grant.qty, 0);
    const remaining = Math.max(0, authorized - granted);

    return { authorized, granted, remaining };
  }

  getIssuedByClass(securityClassId: string): number {
    return this.model.issuances
      .filter(i => i.securityClassId === securityClassId)
      .reduce((sum, i) => sum + i.qty, 0);
  }

  getRemainingAuthorized(securityClassId: string): number {
    const sc = this.getSecurityClass(securityClassId);
    if (!sc) {
      throw new Error(`Security class with ID "${securityClassId}" not found`);
    }

    if (sc.kind === 'OPTION_POOL') {
      const pool = this.validatePoolCapacity(securityClassId);
      return pool.remaining;
    }

    const issued = this.getIssuedByClass(securityClassId);
    return Math.max(0, sc.authorized - issued);
  }

  updateAuthorized(id: string, newAuthorized: number): SecurityClass {
    const index = this.model.securityClasses.findIndex(sc => sc.id === id);
    if (index === -1) {
      throw new Error(`Security class with ID "${id}" not found`);
    }

    const sc = this.model.securityClasses[index];
    
    if (sc.kind === 'OPTION_POOL') {
      const pool = this.validatePoolCapacity(id);
      if (newAuthorized < pool.granted) {
        throw new Error(
          `Cannot reduce authorized to ${newAuthorized} - already granted ${pool.granted} options`
        );
      }
    } else {
      const issued = this.getIssuedByClass(id);
      if (newAuthorized < issued) {
        throw new Error(
          `Cannot reduce authorized to ${newAuthorized} - already issued ${issued} shares`
        );
      }
    }

    sc.authorized = newAuthorized;
    return sc;
  }

  removeSecurityClass(id: string): void {
    const hasIssuances = this.model.issuances.some(i => i.securityClassId === id);
    
    if (hasIssuances) {
      throw new Error(`Cannot remove security class "${id}" - has existing issuances`);
    }

    const sc = this.getSecurityClass(id);
    if (sc?.kind === 'OPTION_POOL') {
      const pool = this.validatePoolCapacity(id);
      if (pool.granted > 0) {
        throw new Error(`Cannot remove option pool "${id}" - has ${pool.granted} granted options`);
      }
    }

    const index = this.model.securityClasses.findIndex(sc => sc.id === id);
    if (index === -1) {
      throw new Error(`Security class with ID "${id}" not found`);
    }

    this.model.securityClasses.splice(index, 1);
  }
}