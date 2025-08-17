import { z } from 'zod';

export type UUID = string;

export type Kind = 'COMMON' | 'PREF' | 'OPTION_POOL';

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
  }),
  stakeholders: z.array(StakeholderSchema),
  securityClasses: z.array(SecurityClassSchema),
  issuances: z.array(IssuanceSchema),
  optionGrants: z.array(OptionGrantSchema),
  valuations: z.array(z.any()),
  audit: z.array(AuditEntrySchema),
});

export type FileModel = z.infer<typeof FileModelSchema>;

export function monthsBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO);
  const b = new Date(bISO);
  let months = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());

  if (a.getDate() < b.getDate()) {
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
