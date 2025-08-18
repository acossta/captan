import { z } from 'zod';

export type UUID = string;

export type Kind = 'COMMON' | 'PREF' | 'OPTION_POOL';

export type EntityType = 'C_CORP' | 'S_CORP' | 'LLC';

export const VestingSchema = z.object({
  start: z.string(),
  monthsTotal: z.number().int().positive(),
  cliffMonths: z.number().int().nonnegative(),
});

export type Vesting = z.infer<typeof VestingSchema>;

export const StakeholderSchema = z.object({
  id: z.string(),
  type: z.enum(['person', 'entity']),
  name: z.string().min(1),
  email: z.string().email().optional(),
});

export type Stakeholder = z.infer<typeof StakeholderSchema>;

export const SecurityClassSchema = z.object({
  id: z.string(),
  kind: z.enum(['COMMON', 'PREF', 'OPTION_POOL']),
  label: z.string().min(1),
  parValue: z.number().optional(),
  authorized: z.number().positive(),
});

export type SecurityClass = z.infer<typeof SecurityClassSchema>;

export const IssuanceSchema = z.object({
  id: z.string(),
  securityClassId: z.string(),
  stakeholderId: z.string(),
  qty: z.number().positive(),
  pps: z.number().nonnegative().optional(),
  date: z.string(),
  cert: z.string().optional(),
});

export type Issuance = z.infer<typeof IssuanceSchema>;

export const OptionGrantSchema = z.object({
  id: z.string(),
  stakeholderId: z.string(),
  qty: z.number().positive(),
  exercise: z.number().positive(),
  grantDate: z.string(),
  vesting: VestingSchema.optional(),
});

export type OptionGrant = z.infer<typeof OptionGrantSchema>;

export const SAFESchema = z.object({
  id: z.string(),
  stakeholderId: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  cap: z.number().positive().optional(),
  discount: z.number().min(0).max(1).optional(),
  type: z.enum(['pre', 'post']).optional(),
  note: z.string().optional(),
});

export type SAFE = z.infer<typeof SAFESchema>;

export const AuditEntrySchema = z.object({
  ts: z.string(),
  by: z.string(),
  action: z.string(),
  data: z.any(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const FileModelSchema = z.object({
  version: z.number(),
  company: z.object({
    id: z.string(),
    name: z.string(),
    formationDate: z.string().optional(),
    entityType: z.enum(['C_CORP', 'S_CORP', 'LLC']).optional(),
    jurisdiction: z.string().optional(),
    currency: z.string().optional(),
  }),
  stakeholders: z.array(StakeholderSchema),
  securityClasses: z.array(SecurityClassSchema),
  issuances: z.array(IssuanceSchema),
  optionGrants: z.array(OptionGrantSchema),
  safes: z.array(SAFESchema),
  valuations: z.array(z.any()),
  audit: z.array(AuditEntrySchema),
});

export type FileModel = z.infer<typeof FileModelSchema>;

/**
 * Parse an ISO date string to UTC date, handling various formats
 * Ensures consistent UTC handling regardless of system timezone
 */
export function parseUTCDate(dateStr: string): Date {
  // Handle ISO date strings (YYYY-MM-DD) by forcing UTC interpretation
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    // Append T00:00:00.000Z to force UTC
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  // Handle full ISO 8601 strings
  if (dateStr.includes('T')) {
    // If already has time component, ensure it's interpreted as UTC
    if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
      return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
  }

  // Fallback: treat as UTC date at midnight
  return new Date(dateStr + 'T00:00:00.000Z');
}

/**
 * Format a Date to ISO date string (YYYY-MM-DD) in UTC
 */
export function formatUTCDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate an ISO date string
 */
export function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(dateStr)) {
    return false;
  }
  const date = parseUTCDate(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Get today's date as ISO string in UTC
 */
export function getTodayUTC(): string {
  return formatUTCDate(new Date());
}

export function monthsBetween(aISO: string, bISO: string): number {
  // Parse dates as UTC to ensure timezone consistency
  const a = parseUTCDate(aISO);
  const b = parseUTCDate(bISO);

  let months = (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + (a.getUTCMonth() - b.getUTCMonth());

  // Adjust for day of month
  if (a.getUTCDate() < b.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function vestedQty(asOfISO: string, qty: number, vesting?: Vesting): number {
  if (!vesting) return 0;

  const monthsElapsed = monthsBetween(asOfISO, vesting.start);

  if (monthsElapsed < vesting.cliffMonths) {
    return 0;
  }

  const monthsProgressed = Math.min(monthsElapsed, vesting.monthsTotal);
  return Math.floor((monthsProgressed / vesting.monthsTotal) * qty);
}

export interface CapTableRow {
  name: string;
  outstanding: number;
  pctOutstanding: number;
  fullyDiluted: number;
  pctFullyDiluted: number;
}

export interface CapTableTotals {
  issuedTotal: number;
  vestedOptions: number;
  unvestedOptions: number;
  outstandingTotal: number;
  fd: {
    issued: number;
    grants: number;
    poolRemaining: number;
    totalFD: number;
  };
}

export interface CapTableResult {
  rows: CapTableRow[];
  totals: CapTableTotals;
}

export function getEntityDefaults(entityType: EntityType) {
  switch (entityType) {
    case 'C_CORP':
    case 'S_CORP':
      return {
        authorized: 10000000,
        parValue: 0.0001,
        unitsName: 'Shares',
        holderName: 'Stockholder',
        poolPct: 20,
      };
    case 'LLC':
      return {
        authorized: 1000000,
        parValue: undefined,
        unitsName: 'Units',
        holderName: 'Member',
        poolPct: 0,
      };
  }
}

export interface SAFEConversion {
  safeId: string;
  stakeholderId: string;
  stakeholderName: string;
  investmentAmount: number;
  sharesIssued: number;
  conversionPrice: number;
  conversionReason: 'cap' | 'discount' | 'price';
}

/**
 * Calculate post-money SAFE conversion price using iterative method
 * Post-money cap = existing shares + new shares from SAFE
 * This requires solving: shares = amount / (cap / (existingShares + shares))
 */
function calculatePostMoneyCapPrice(
  safeAmount: number,
  safeCap: number,
  existingShares: number,
  maxIterations = 10,
  tolerance = 0.01
): { price: number; shares: number } {
  // Handle edge cases
  if (existingShares === 0 || safeCap === 0) {
    return { price: 1, shares: safeAmount };
  }

  // Initial guess: use pre-money calculation as starting point
  let shares = safeAmount / (safeCap / existingShares);

  // Iterate to converge on solution
  for (let i = 0; i < maxIterations; i++) {
    const newPrice = safeCap / (existingShares + shares);
    const newShares = safeAmount / newPrice;

    // Check convergence
    if (Math.abs(newShares - shares) < tolerance) {
      return { price: newPrice, shares: Math.floor(newShares) };
    }

    shares = newShares;
  }

  // Return best approximation after max iterations
  const finalPrice = safeCap / (existingShares + shares);
  return { price: finalPrice, shares: Math.floor(safeAmount / finalPrice) };
}

export function convertSAFE(
  safe: SAFE,
  pricePerShare: number,
  preMoneyShares: number,
  isPostMoney = false
): SAFEConversion {
  // Validate inputs
  if (safe.amount <= 0) {
    return {
      safeId: safe.id,
      stakeholderId: safe.stakeholderId,
      stakeholderName: '',
      investmentAmount: safe.amount,
      sharesIssued: 0,
      conversionPrice: pricePerShare,
      conversionReason: 'price',
    };
  }

  // Handle edge case of zero price
  if (pricePerShare <= 0 && (!safe.cap || safe.cap <= 0)) {
    // Cannot convert without valid price
    return {
      safeId: safe.id,
      stakeholderId: safe.stakeholderId,
      stakeholderName: '',
      investmentAmount: safe.amount,
      sharesIssued: 0,
      conversionPrice: 0,
      conversionReason: 'price',
    };
  }

  // Calculate discount price if applicable
  const discountPrice =
    safe.discount !== undefined && safe.discount > 0
      ? pricePerShare * safe.discount
      : pricePerShare;

  // Calculate cap price if applicable
  let capPrice = Number.MAX_VALUE;
  let capShares = 0;

  if (safe.cap && safe.cap > 0) {
    if ((isPostMoney || safe.type === 'post') && preMoneyShares > 0) {
      // Post-money SAFE: use iterative calculation
      const postMoneyResult = calculatePostMoneyCapPrice(safe.amount, safe.cap, preMoneyShares);
      capPrice = postMoneyResult.price;
      capShares = postMoneyResult.shares;
    } else if (preMoneyShares > 0) {
      // Pre-money SAFE: cap divided by existing shares
      capPrice = safe.cap / preMoneyShares;
      capShares = Math.floor(safe.amount / capPrice);
    } else {
      // No existing shares, use cap as absolute ceiling
      capPrice = pricePerShare < safe.cap ? pricePerShare : safe.cap;
      capShares = Math.floor(safe.amount / capPrice);
    }
  }

  // Determine effective conversion price and shares
  let effectivePrice = pricePerShare;
  let sharesIssued = Math.floor(safe.amount / pricePerShare);
  let reason: 'cap' | 'discount' | 'price' = 'price';

  // Check if cap price is better
  if (safe.cap && capPrice < effectivePrice && capPrice > 0) {
    effectivePrice = capPrice;
    sharesIssued = capShares;
    reason = 'cap';
  }

  // Check if discount price is better
  if (safe.discount !== undefined && discountPrice < effectivePrice && discountPrice > 0) {
    effectivePrice = discountPrice;
    sharesIssued = Math.floor(safe.amount / discountPrice);
    reason = 'discount';
  }

  // Handle edge case where effectivePrice could be negative or zero
  if (effectivePrice <= 0) {
    effectivePrice = Math.abs(effectivePrice) || 0.000001;
    sharesIssued = effectivePrice > 0 ? Math.floor(safe.amount / effectivePrice) : 0;
  }

  return {
    safeId: safe.id,
    stakeholderId: safe.stakeholderId,
    stakeholderName: '', // Will be filled by service
    investmentAmount: safe.amount,
    sharesIssued,
    conversionPrice: effectivePrice,
    conversionReason: reason,
  };
}

export function calcCap(model: FileModel, asOfISO: string): CapTableResult {
  const scById = Object.fromEntries(model.securityClasses.map((s) => [s.id, s]));
  const stakeholderById = Object.fromEntries(model.stakeholders.map((s) => [s.id, s]));

  const byStakeholder: Record<
    string,
    {
      name: string;
      outstanding: number;
      fullyDiluted: number;
    }
  > = {};

  const nameOf = (sid: string) => stakeholderById[sid]?.name ?? sid;

  let issuedTotal = 0;
  for (const issuance of model.issuances) {
    const sc = scById[issuance.securityClassId];
    if (!sc || sc.kind === 'OPTION_POOL') continue;

    issuedTotal += issuance.qty;
    const bucket = (byStakeholder[issuance.stakeholderId] ??= {
      name: nameOf(issuance.stakeholderId),
      outstanding: 0,
      fullyDiluted: 0,
    });
    bucket.outstanding += issuance.qty;
    bucket.fullyDiluted += issuance.qty;
  }

  const grantsTotal = model.optionGrants.reduce((sum, grant) => sum + grant.qty, 0);
  let vestedTotal = 0;
  let unvestedTotal = 0;

  for (const grant of model.optionGrants) {
    const vested = vestedQty(asOfISO, grant.qty, grant.vesting);
    const unvested = grant.qty - vested;

    vestedTotal += vested;
    unvestedTotal += unvested;

    const bucket = (byStakeholder[grant.stakeholderId] ??= {
      name: nameOf(grant.stakeholderId),
      outstanding: 0,
      fullyDiluted: 0,
    });
    bucket.outstanding += vested;
    bucket.fullyDiluted += grant.qty;
  }

  const pools = model.securityClasses.filter((sc) => sc.kind === 'OPTION_POOL');
  const poolAuthorized = pools.reduce((sum, pool) => sum + pool.authorized, 0);
  const poolRemaining = Math.max(0, poolAuthorized - grantsTotal);

  const outstandingTotal = issuedTotal + vestedTotal;
  const fdTotal = issuedTotal + grantsTotal + poolRemaining;

  const rows = Object.values(byStakeholder)
    .map((stakeholder) => ({
      name: stakeholder.name,
      outstanding: stakeholder.outstanding,
      pctOutstanding: outstandingTotal ? stakeholder.outstanding / outstandingTotal : 0,
      fullyDiluted: stakeholder.fullyDiluted,
      pctFullyDiluted: fdTotal ? stakeholder.fullyDiluted / fdTotal : 0,
    }))
    .sort((a, b) => b.fullyDiluted - a.fullyDiluted);

  return {
    rows,
    totals: {
      issuedTotal,
      vestedOptions: vestedTotal,
      unvestedOptions: unvestedTotal,
      outstandingTotal,
      fd: {
        issued: issuedTotal,
        grants: grantsTotal,
        poolRemaining,
        totalFD: fdTotal,
      },
    },
  };
}
