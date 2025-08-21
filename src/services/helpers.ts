/**
 * Helper functions for services that work with the captable model directly
 * These are simpler functional versions for the new CLI handlers
 */

import { randomUUID } from 'node:crypto';
import {
  FileModel,
  Stakeholder,
  SecurityClass,
  Issuance,
  OptionGrant,
  SAFE,
  Vesting,
  vestedQty,
} from '../model.js';

type Captable = FileModel;

// ============================================
// STAKEHOLDER HELPERS
// ============================================

export function createStakeholder(
  name: string,
  email: string,
  entityType: 'PERSON' | 'ENTITY' = 'PERSON'
): Stakeholder {
  return {
    id: `sh_${randomUUID()}`,
    name,
    email: email || undefined,
    type: entityType === 'ENTITY' ? 'entity' : 'person',
  };
}

// ============================================
// SECURITY CLASS HELPERS
// ============================================

export function createSecurityClass(
  kind: 'COMMON' | 'PREFERRED' | 'OPTION_POOL',
  label: string,
  authorized: number,
  parValue?: number
): SecurityClass {
  const mappedKind = kind === 'PREFERRED' ? 'PREF' : kind;
  return {
    id: `sc_${randomUUID()}`,
    kind: mappedKind as 'COMMON' | 'PREF' | 'OPTION_POOL',
    label,
    authorized,
    parValue,
  };
}

export function getIssuedShares(captable: Captable, securityClassId: string): number {
  if (!captable.issuances) return 0;

  return captable.issuances
    .filter((i: Issuance) => i.securityClassId === securityClassId)
    .reduce((sum: number, i: Issuance) => sum + i.qty, 0);
}

// ============================================
// ISSUANCE HELPERS
// ============================================

export function createIssuance(
  stakeholderId: string,
  securityClassId: string,
  qty: number,
  pricePerShare?: number,
  date: string = new Date().toISOString().slice(0, 10),
  certificateNumber?: string
): Issuance {
  return {
    id: `is_${randomUUID()}`,
    stakeholderId,
    securityClassId,
    qty,
    pps: pricePerShare,
    date,
    cert: certificateNumber,
  };
}

// ============================================
// OPTION GRANT HELPERS
// ============================================

export function createOptionGrant(
  stakeholderId: string,
  optionPoolId: string, // Not stored but used for validation
  qty: number,
  exercisePrice: number,
  date: string = new Date().toISOString().slice(0, 10),
  vesting?: Vesting
): OptionGrant {
  // Note: optionPoolId is not part of the OptionGrant model
  // It's only used for validation during creation
  return {
    id: `og_${randomUUID()}`,
    stakeholderId,
    qty,
    exercise: exercisePrice,
    grantDate: date,
    vesting,
  };
}

export function calculateVestedOptions(grant: OptionGrant, asOfDate: string): number {
  if (!grant.vesting) {
    return grant.qty;
  }

  return vestedQty(asOfDate, grant.qty, grant.vesting);
}

// ============================================
// SAFE HELPERS
// ============================================

export function createSAFE(
  stakeholderId: string,
  amount: number,
  valuationCap?: number,
  discountPct?: number,
  isPostMoney: boolean = false,
  date: string = new Date().toISOString().slice(0, 10),
  note?: string
): SAFE {
  return {
    id: `safe_${randomUUID()}`,
    stakeholderId,
    amount,
    cap: valuationCap,
    discount: discountPct ? discountPct / 100 : undefined, // Convert to 0-1 range
    type: isPostMoney ? 'post' : 'pre',
    date,
    note,
  };
}

export interface SAFEConversion {
  safe: SAFE;
  shares: number;
  conversionPrice: number;
  conversionReason: 'cap' | 'discount' | 'price';
}

export function calculateSAFEConversions(
  captable: Captable,
  pricePerShare: number,
  _preMoneyValuation: number
): SAFEConversion[] {
  if (!captable.safes || captable.safes.length === 0) {
    return [];
  }

  // Calculate total outstanding shares (for cap calculations)
  const outstandingShares = captable.issuances
    ? captable.issuances.reduce((sum: number, i: Issuance) => sum + i.qty, 0)
    : 0;

  const conversions: SAFEConversion[] = [];

  for (const safe of captable.safes) {
    let conversionPrice = pricePerShare;
    let conversionReason: 'cap' | 'discount' | 'price' = 'price';

    // Calculate cap price if applicable
    if (safe.cap && outstandingShares > 0) {
      const capPrice =
        safe.type === 'post'
          ? safe.cap / (outstandingShares + safe.amount / pricePerShare)
          : safe.cap / outstandingShares;

      if (capPrice < conversionPrice) {
        conversionPrice = capPrice;
        conversionReason = 'cap';
      }
    }

    // Calculate discount price if applicable
    if (safe.discount) {
      const discountPrice = pricePerShare * (1 - safe.discount);
      if (discountPrice < conversionPrice) {
        conversionPrice = discountPrice;
        conversionReason = 'discount';
      }
    }

    const shares = Math.floor(safe.amount / conversionPrice);

    conversions.push({
      safe,
      shares,
      conversionPrice,
      conversionReason,
    });
  }

  return conversions;
}

// ============================================
// HOLDINGS HELPERS
// ============================================

export interface StakeholderHoldings {
  stakeholder: Stakeholder;
  issuances: Issuance[];
  grants: OptionGrant[];
  safes: SAFE[];
}

export function getStakeholderHoldings(
  captable: Captable,
  stakeholderId: string
): StakeholderHoldings {
  const stakeholder = captable.stakeholders.find((sh) => sh.id === stakeholderId);

  if (!stakeholder) {
    throw new Error(`Stakeholder not found: ${stakeholderId}`);
  }

  return {
    stakeholder,
    issuances: captable.issuances?.filter((i: Issuance) => i.stakeholderId === stakeholderId) || [],
    grants:
      captable.optionGrants?.filter((g: OptionGrant) => g.stakeholderId === stakeholderId) || [],
    safes: captable.safes?.filter((s: SAFE) => s.stakeholderId === stakeholderId) || [],
  };
}

// ============================================
// AUDIT HELPERS
// ============================================

export function logAction(
  captable: Captable,
  entry: {
    action: string;
    entity: string;
    entityId: string;
    details: string;
  }
): void {
  if (!captable.audit) {
    captable.audit = [];
  }

  captable.audit.push({
    ts: new Date().toISOString(),
    by: 'captan-cli',
    action: entry.action,
    data: {
      entity: entry.entity,
      entityId: entry.entityId,
      details: entry.details,
    },
  });
}
