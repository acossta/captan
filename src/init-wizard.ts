import { input, select, confirm, number } from '@inquirer/prompts';
import { EntityType, FileModel, getEntityDefaults } from './model.js';
import { randomUUID } from 'node:crypto';

export interface FounderInput {
  name: string;
  email?: string;
  shares: number;
}

export interface WizardResult {
  name: string;
  formationDate: string;
  entityType: EntityType;
  jurisdiction: string;
  currency: string;
  authorized: number;
  parValue?: number;
  poolSize?: number;
  poolPct?: number;
  founders: FounderInput[];
}

export async function runInitWizard(): Promise<WizardResult> {
  console.log('\n🧭 Captan Initialization Wizard\n');

  // Company basics
  const name = await input({
    message: 'Company name:',
    default: 'Acme, Inc.',
  });

  const formationDate = await input({
    message: 'Incorporation date (YYYY-MM-DD):',
    default: new Date().toISOString().slice(0, 10),
  });

  const entityType = (await select({
    message: 'Entity type:',
    choices: [
      { value: 'C_CORP', name: 'C-Corporation (standard for VC-backed startups)' },
      { value: 'S_CORP', name: 'S-Corporation' },
      { value: 'LLC', name: 'LLC (Limited Liability Company)' },
    ],
  })) as EntityType;

  const defaults = getEntityDefaults(entityType);
  const isCorp = entityType === 'C_CORP' || entityType === 'S_CORP';

  const jurisdiction = await input({
    message: 'State of incorporation:',
    default: 'DE',
  });

  const currency = await input({
    message: 'Currency:',
    default: 'USD',
  });

  // Shares/Units
  const authorized = await number({
    message: `Authorized ${defaults.unitsName.toLowerCase()}:`,
    default: defaults.authorized,
  });

  let parValue: number | undefined;
  if (isCorp) {
    parValue = await number({
      message: 'Par value per share:',
      default: defaults.parValue,
      step: 'any',
      validate: (val) =>
        val === undefined || (typeof val === 'number' && val >= 0)
          ? true
          : 'Par value must be a non-negative number',
    });
  }

  // Option pool
  let poolSize: number | undefined;
  let poolPct: number | undefined;

  const createPool = await confirm({
    message: 'Create an option pool?',
    default: isCorp,
  });

  if (createPool) {
    const poolType = await select({
      message: 'How would you like to specify the pool size?',
      choices: [
        { value: 'percent', name: 'As percentage of fully diluted equity' },
        { value: 'absolute', name: `As absolute number of ${defaults.unitsName.toLowerCase()}` },
      ],
    });

    if (poolType === 'percent') {
      poolPct = await number({
        message: `Pool percentage (e.g., ${defaults.poolPct} for ${defaults.poolPct}%):`,
        default: defaults.poolPct,
        validate: (val) =>
          val === undefined || (typeof val === 'number' && val >= 0 && val <= 100)
            ? true
            : 'Pool percentage must be between 0 and 100',
      });
    } else {
      poolSize = await number({
        message: `Number of ${defaults.unitsName.toLowerCase()} for pool:`,
        default: Math.floor((authorized || 10000000) * (defaults.poolPct / 100)),
        validate: (val) =>
          val === undefined || (typeof val === 'number' && val >= 0)
            ? true
            : 'Pool size must be a non-negative number',
      });
    }
  }

  // Founders
  const founders: FounderInput[] = [];
  const addFounders = await confirm({
    message: 'Add founders now?',
    default: true,
  });

  if (addFounders) {
    let addMore = true;
    while (addMore) {
      const founderName = await input({
        message: 'Founder name:',
      });

      const founderEmail = await input({
        message: 'Founder email (optional):',
        default: undefined,
      });

      const founderShares = await number({
        message: `Number of ${defaults.unitsName.toLowerCase()}:`,
      });

      if (founderShares && founderShares > 0) {
        founders.push({
          name: founderName,
          email: founderEmail || undefined,
          shares: founderShares,
        });
      }

      addMore = await confirm({
        message: 'Add another founder?',
        default: false,
      });
    }
  }

  return {
    name,
    formationDate,
    entityType,
    jurisdiction,
    currency,
    authorized: authorized || defaults.authorized,
    parValue,
    poolSize,
    poolPct,
    founders,
  };
}

export function parseFounderString(founderStr: string): FounderInput {
  // Formats:
  // "Name:qty"
  // "Name:qty@pps" (pps ignored for simplicity)
  // "Name:email:qty"
  // "Name:email:qty@pps"

  const parts = founderStr.split(':');

  if (parts.length === 2) {
    // "Name:qty" or "Name:qty@pps"
    const [name, qtyPart] = parts;
    const qty = parseInt(qtyPart.split('@')[0].replace(/,/g, ''));
    return { name: name.trim(), shares: qty };
  } else if (parts.length === 3) {
    // "Name:email:qty" or "Name:email:qty@pps"
    const [name, email, qtyPart] = parts;
    const qty = parseInt(qtyPart.split('@')[0].replace(/,/g, ''));
    return {
      name: name.trim(),
      email: email.trim(),
      shares: qty,
    };
  }

  throw new Error(`Invalid founder format: ${founderStr}`);
}

export function calculatePoolFromPercentage(founderShares: number, poolPct: number): number {
  // Pool as percentage of fully diluted (founders + pool)
  // If founders have F shares and we want pool to be P% of total:
  // Pool / (Founders + Pool) = P/100
  // Pool = (P/100) * (F + Pool)
  // Pool * (1 - P/100) = F * (P/100)
  // Pool = F * (P/100) / (1 - P/100)
  const ratio = poolPct / 100;
  return Math.floor((founderShares * ratio) / (1 - ratio));
}

export function buildModelFromWizard(result: WizardResult): FileModel {
  const model: FileModel = {
    version: 1,
    company: {
      id: `comp_${randomUUID()}`,
      name: result.name,
      formationDate: result.formationDate,
      entityType: result.entityType,
      jurisdiction: result.jurisdiction,
      currency: result.currency,
    },
    stakeholders: [],
    securityClasses: [],
    issuances: [],
    optionGrants: [],
    safes: [],
    valuations: [],
    audit: [],
  };

  const isCorp = result.entityType === 'C_CORP' || result.entityType === 'S_CORP';

  // Add common stock/units class
  model.securityClasses.push({
    id: 'sc_common',
    kind: 'COMMON',
    label: isCorp ? 'Common Stock' : 'Common Units',
    authorized: result.authorized,
    parValue: result.parValue,
  });

  // Add founders
  let totalFounderShares = 0;
  for (const founder of result.founders) {
    const stakeholderId = `sh_${randomUUID()}`;
    model.stakeholders.push({
      id: stakeholderId,
      type: 'person',
      name: founder.name,
      email: founder.email,
    });

    if (founder.shares > 0) {
      model.issuances.push({
        id: `is_${randomUUID()}`,
        securityClassId: 'sc_common',
        stakeholderId,
        qty: founder.shares,
        pps: result.parValue || 0,
        date: model.company.formationDate!,
      });
      totalFounderShares += founder.shares;
    }
  }

  // Calculate and add pool
  let poolQty = result.poolSize;
  if (!poolQty && result.poolPct && totalFounderShares > 0) {
    poolQty = calculatePoolFromPercentage(totalFounderShares, result.poolPct);
  }

  if (poolQty && poolQty > 0) {
    const currentYear = new Date().getFullYear();
    model.securityClasses.push({
      id: 'sc_pool',
      kind: 'OPTION_POOL',
      label: `${currentYear} Stock Option Plan`,
      authorized: poolQty,
    });
  }

  return model;
}
