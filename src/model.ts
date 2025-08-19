import { z } from 'zod';

export type UUID = string;

export type Kind = 'COMMON' | 'PREF' | 'OPTION_POOL';

export type EntityType = 'C_CORP' | 'S_CORP' | 'LLC';

// Custom Zod types with format validation
export const ISODateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((dateStr) => {
    const date = new Date(dateStr + 'T00:00:00.000Z');
    return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
  }, 'Invalid date');

export const UUIDSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
    'Invalid UUID format'
  );

// More flexible ID schema that allows existing patterns:
// - Hardcoded IDs like 'sc_common', 'sc_pool'
// - Generated IDs like 'sh_UUID', 'is_UUID'
export const PrefixedIdSchema = z
  .string()
  .regex(/^[a-z]+_[a-zA-Z0-9-]+$/, 'ID must be in format: prefix_identifier');

export const CurrencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code (e.g., USD, EUR)');

export const EmailSchema = z.string().email('Invalid email address');

export const PercentageSchema = z
  .number()
  .min(0, 'Percentage must be between 0 and 1')
  .max(1, 'Percentage must be between 0 and 1');

export const VestingSchema = z.object({
  start: ISODateSchema.describe('Vesting start date in YYYY-MM-DD format'),
  monthsTotal: z.number().int().positive().describe('Total vesting period in months'),
  cliffMonths: z.number().int().nonnegative().describe('Cliff period in months'),
});

export type Vesting = z.infer<typeof VestingSchema>;

export const StakeholderSchema = z.object({
  id: PrefixedIdSchema.describe('Unique stakeholder identifier'),
  type: z.enum(['person', 'entity']).describe('Type of stakeholder'),
  name: z.string().min(1).describe('Full name or entity name'),
  email: EmailSchema.optional().describe('Contact email address'),
});

export type Stakeholder = z.infer<typeof StakeholderSchema>;

export const SecurityClassSchema = z.object({
  id: PrefixedIdSchema.describe('Unique security class identifier'),
  kind: z.enum(['COMMON', 'PREF', 'OPTION_POOL']).describe('Type of security'),
  label: z.string().min(1).describe('Human-readable label for the security class'),
  parValue: z.number().optional().describe('Par value per share'),
  authorized: z.number().positive().describe('Total authorized shares'),
});

export type SecurityClass = z.infer<typeof SecurityClassSchema>;

export const IssuanceSchema = z.object({
  id: PrefixedIdSchema.describe('Unique issuance identifier'),
  securityClassId: PrefixedIdSchema.describe('Reference to security class'),
  stakeholderId: PrefixedIdSchema.describe('Reference to stakeholder'),
  qty: z.number().positive().describe('Number of shares issued'),
  pps: z.number().nonnegative().optional().describe('Price per share at issuance'),
  date: ISODateSchema.describe('Issuance date in YYYY-MM-DD format'),
  cert: z.string().optional().describe('Certificate number'),
});

export type Issuance = z.infer<typeof IssuanceSchema>;

export const OptionGrantSchema = z.object({
  id: PrefixedIdSchema.describe('Unique option grant identifier'),
  stakeholderId: PrefixedIdSchema.describe('Reference to stakeholder'),
  qty: z.number().positive().describe('Number of options granted'),
  exercise: z.number().positive().describe('Exercise price per option'),
  grantDate: ISODateSchema.describe('Grant date in YYYY-MM-DD format'),
  vesting: VestingSchema.optional().describe('Vesting schedule'),
});

export type OptionGrant = z.infer<typeof OptionGrantSchema>;

export const SAFESchema = z.object({
  id: PrefixedIdSchema.describe('Unique SAFE identifier'),
  stakeholderId: PrefixedIdSchema.describe('Reference to stakeholder'),
  amount: z.number().positive().describe('Investment amount'),
  date: ISODateSchema.describe('Investment date in YYYY-MM-DD format'),
  cap: z.number().positive().optional().describe('Valuation cap'),
  discount: PercentageSchema.optional().describe('Discount rate (0-1)'),
  type: z.enum(['pre', 'post']).optional().describe('Pre-money or post-money SAFE'),
  note: z.string().optional().describe('Additional notes'),
});

export type SAFE = z.infer<typeof SAFESchema>;

export const ValuationSchema = z.object({
  id: PrefixedIdSchema.describe('Unique valuation identifier'),
  date: ISODateSchema.describe('Valuation date in YYYY-MM-DD format'),
  type: z
    .enum(['409a', 'common', 'preferred', 'series_a', 'series_b', 'series_c', 'other'])
    .describe('Type of valuation'),
  preMoney: z.number().nonnegative().optional().describe('Pre-money valuation amount'),
  postMoney: z.number().nonnegative().optional().describe('Post-money valuation amount'),
  sharePrice: z.number().positive().optional().describe('Share price from valuation'),
  methodology: z.string().optional().describe('Valuation methodology used'),
  provider: z.string().optional().describe('Valuation provider or firm'),
  note: z.string().optional().describe('Additional notes'),
});

export type Valuation = z.infer<typeof ValuationSchema>;

export const AuditEntrySchema = z.object({
  ts: z.string().describe('Timestamp in ISO 8601 format'),
  by: z.string().describe('User or system that performed the action'),
  action: z.string().describe('Action performed'),
  data: z.any().describe('Additional data related to the action'),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const FileModelSchema = z.object({
  version: z.number().describe('Schema version number'),
  company: z
    .object({
      id: PrefixedIdSchema.describe('Unique company identifier'),
      name: z.string().describe('Legal company name'),
      formationDate: ISODateSchema.optional().describe(
        'Company formation date in YYYY-MM-DD format'
      ),
      entityType: z.enum(['C_CORP', 'S_CORP', 'LLC']).optional().describe('Type of legal entity'),
      jurisdiction: z.string().optional().describe('Jurisdiction of incorporation (e.g., DE, CA)'),
      currency: CurrencyCodeSchema.optional().describe(
        'Primary currency for transactions (ISO 4217)'
      ),
    })
    .describe('Company information'),
  stakeholders: z.array(StakeholderSchema).describe('List of all stakeholders'),
  securityClasses: z.array(SecurityClassSchema).describe('List of security classes'),
  issuances: z.array(IssuanceSchema).describe('List of share issuances'),
  optionGrants: z.array(OptionGrantSchema).describe('List of option grants'),
  safes: z.array(SAFESchema).describe('List of SAFE instruments'),
  valuations: z.array(ValuationSchema).describe('List of company valuations'),
  audit: z.array(AuditEntrySchema).describe('Audit trail of all changes'),
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
        parValue: 0.00001,
        unitsName: 'Shares',
        holderName: 'Stockholder',
        poolPct: 10,
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
