import { randomUUID } from 'node:crypto';
import { FileModel, SAFE, SAFESchema, SAFEConversion, convertSAFE } from '../model.js';
import { StakeholderService } from './stakeholder-service.js';

export interface RoundTerms {
  preMoneyValuation: number;
  newMoneyRaised: number;
  pricePerShare?: number;
}

export interface ConversionResult extends SAFEConversion {
  stakeholderName: string;
}

export class SAFEService {
  private stakeholderService: StakeholderService;

  constructor(private model: FileModel) {
    this.stakeholderService = new StakeholderService(model);
  }

  addSAFE(params: {
    stakeholderId: string;
    amount: number;
    date?: string;
    cap?: number;
    discount?: number;
    type?: 'pre' | 'post';
    note?: string;
  }): SAFE {
    // Validate stakeholder exists
    this.stakeholderService.validateStakeholderExists(params.stakeholderId);

    // Validate discount is a percentage (0-1)
    if (params.discount !== undefined) {
      if (params.discount < 0 || params.discount > 1) {
        throw new Error('Discount must be between 0 and 1 (e.g., 0.8 for 20% discount)');
      }
    }

    const safe: SAFE = {
      id: `safe_${randomUUID()}`,
      stakeholderId: params.stakeholderId,
      amount: params.amount,
      date: params.date || new Date().toISOString().slice(0, 10),
      cap: params.cap,
      discount: params.discount,
      type: params.type,
      note: params.note,
    };

    const validated = SAFESchema.parse(safe);
    this.model.safes.push(validated);
    return validated;
  }

  getSAFE(id: string): SAFE | undefined {
    return this.model.safes.find((s) => s.id === id);
  }

  listSAFEs(): SAFE[] {
    return [...this.model.safes];
  }

  getSAFEsByStakeholder(stakeholderId: string): SAFE[] {
    return this.model.safes.filter((s) => s.stakeholderId === stakeholderId);
  }

  getTotalSAFEAmount(): number {
    return this.model.safes.reduce((sum, safe) => sum + safe.amount, 0);
  }

  removeSAFE(id: string): void {
    const index = this.model.safes.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`SAFE with ID "${id}" not found`);
    }
    this.model.safes.splice(index, 1);
  }

  simulateConversion(roundTerms: RoundTerms): ConversionResult[] {
    const { preMoneyValuation, newMoneyRaised, pricePerShare } = roundTerms;

    // Calculate price per share if not provided
    const currentShares = this.getCurrentOutstandingShares();
    const pps = pricePerShare || preMoneyValuation / currentShares;

    const conversions: ConversionResult[] = [];

    for (const safe of this.model.safes) {
      const conversion = convertSAFE(safe, pps, currentShares, safe.type === 'post');
      const stakeholder = this.stakeholderService.getStakeholder(safe.stakeholderId);

      conversions.push({
        ...conversion,
        stakeholderName: stakeholder?.name || 'Unknown',
      });
    }

    return conversions;
  }

  private getCurrentOutstandingShares(): number {
    // Calculate total outstanding shares (issued shares only, not options)
    let total = 0;

    for (const issuance of this.model.issuances) {
      const securityClass = this.model.securityClasses.find(
        (sc) => sc.id === issuance.securityClassId
      );
      // Only count non-option pool issuances
      if (securityClass && securityClass.kind !== 'OPTION_POOL') {
        total += issuance.qty;
      }
    }

    return total;
  }

  getSAFEsSummary(): {
    count: number;
    totalAmount: number;
    byStakeholder: Array<{
      stakeholderId: string;
      stakeholderName: string;
      amount: number;
      safes: SAFE[];
    }>;
  } {
    const byStakeholder = new Map<string, { amount: number; safes: SAFE[] }>();

    for (const safe of this.model.safes) {
      if (!byStakeholder.has(safe.stakeholderId)) {
        byStakeholder.set(safe.stakeholderId, { amount: 0, safes: [] });
      }
      const entry = byStakeholder.get(safe.stakeholderId)!;
      entry.amount += safe.amount;
      entry.safes.push(safe);
    }

    const stakeholderSummaries = Array.from(byStakeholder.entries()).map(
      ([stakeholderId, data]) => {
        const stakeholder = this.stakeholderService.getStakeholder(stakeholderId);
        return {
          stakeholderId,
          stakeholderName: stakeholder?.name || 'Unknown',
          amount: data.amount,
          safes: data.safes,
        };
      }
    );

    return {
      count: this.model.safes.length,
      totalAmount: this.getTotalSAFEAmount(),
      byStakeholder: stakeholderSummaries,
    };
  }
}
