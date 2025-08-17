import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { FileModel, Stakeholder, StakeholderSchema } from '../model.js';

export class StakeholderService {
  constructor(private model: FileModel) {}

  addStakeholder(
    name: string,
    type: 'person' | 'entity' = 'person',
    email?: string
  ): Stakeholder {
    const stakeholder: Stakeholder = {
      id: `sh_${randomUUID()}`,
      type,
      name,
      email
    };

    const validated = StakeholderSchema.parse(stakeholder);
    
    if (this.model.stakeholders.some(s => s.name === name && s.type === type)) {
      throw new Error(`Stakeholder "${name}" of type "${type}" already exists`);
    }

    this.model.stakeholders.push(validated);
    return validated;
  }

  getStakeholder(id: string): Stakeholder | undefined {
    return this.model.stakeholders.find(s => s.id === id);
  }

  getStakeholderByName(name: string): Stakeholder | undefined {
    return this.model.stakeholders.find(s => s.name === name);
  }

  listStakeholders(): Stakeholder[] {
    return [...this.model.stakeholders];
  }

  validateStakeholderExists(id: string): void {
    if (!this.getStakeholder(id)) {
      throw new Error(`Stakeholder with ID "${id}" not found`);
    }
  }

  updateStakeholder(id: string, updates: Partial<Omit<Stakeholder, 'id'>>): Stakeholder {
    const index = this.model.stakeholders.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error(`Stakeholder with ID "${id}" not found`);
    }

    const updated = { ...this.model.stakeholders[index], ...updates };
    const validated = StakeholderSchema.parse(updated);
    
    this.model.stakeholders[index] = validated;
    return validated;
  }

  removeStakeholder(id: string): void {
    const hasIssuances = this.model.issuances.some(i => i.stakeholderId === id);
    const hasGrants = this.model.optionGrants.some(g => g.stakeholderId === id);
    
    if (hasIssuances || hasGrants) {
      throw new Error(`Cannot remove stakeholder "${id}" - has existing issuances or grants`);
    }

    const index = this.model.stakeholders.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error(`Stakeholder with ID "${id}" not found`);
    }

    this.model.stakeholders.splice(index, 1);
  }
}