import { randomUUID } from 'node:crypto';
import { FileModel, EntityType, getEntityDefaults, Vesting } from './model.js';
import { StakeholderService } from './services/stakeholder-service.js';
import { SecurityService } from './services/security-service.js';
import { EquityService } from './services/equity-service.js';
import { ReportingService } from './services/reporting-service.js';
import { AuditService } from './services/audit-service.js';
import { SAFEService } from './services/safe-service.js';
import {
  runInitWizard,
  parseFounderString,
  calculatePoolFromPercentage,
  buildModelFromWizard,
} from './init-wizard.js';
import * as store from './store.js';

// Result interfaces
export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface InitOptions {
  name?: string;
  type?: string;
  state?: string;
  currency?: string;
  authorized?: string;
  par?: string;
  pool?: string;
  poolPct?: string;
  founder?: string[];
  date?: string;
  wizard?: boolean;
}

export interface StakeholderOptions {
  name: string;
  email?: string;
  entity?: boolean;
}

export interface IssueOptions {
  stakeholder: string;
  securityClass?: string;
  qty: string;
  price?: string;
  date?: string;
}

export interface GrantOptions {
  stakeholder: string;
  pool?: string;
  qty: string;
  exercise: string;
  date?: string;
  vestMonths?: string;
  vestCliff?: string;
  vestStart?: string;
}

export interface SAFEOptions {
  stakeholder: string;
  amount: string;
  cap?: string;
  discount?: string;
  postMoney?: boolean;
  date?: string;
  note?: string;
}

export interface ChartOptions {
  date?: string;
  format?: string;
}

export interface ExportOptions {
  includeOptions?: boolean;
}

export interface ListOptions {
  type: string;
}

export interface LogOptions {
  limit?: string;
  action?: string;
}

export interface ReportOptions {
  type: string;
  id: string;
}

export interface ConvertOptions {
  price?: string;
  preMoney?: string;
  newMoney?: string;
  date?: string;
  postMoney?: boolean;
  dryRun?: boolean;
}

// Handler functions

export async function handleInit(options: InitOptions): Promise<CommandResult> {
  if (store.exists('captable.json')) {
    return {
      success: false,
      message: '❌ captable.json already exists',
    };
  }

  let model: FileModel;

  try {
    if (options.wizard) {
      const wizardResult = await runInitWizard();
      model = buildModelFromWizard(wizardResult);
    } else {
      const entityTypeStr = (options.type || 'c-corp').toUpperCase().replace('-', '_');
      const entityType = (
        entityTypeStr === 'C_CORP' || entityTypeStr === 'S_CORP' || entityTypeStr === 'LLC'
          ? entityTypeStr
          : 'C_CORP'
      ) as EntityType;

      const defaults = getEntityDefaults(entityType);
      const isCorp = entityType === 'C_CORP' || entityType === 'S_CORP';

      model = {
        version: 1,
        company: {
          id: `comp_${randomUUID()}`,
          name: options.name || 'Untitled, Inc.',
          formationDate: options.date || new Date().toISOString().slice(0, 10),
          entityType,
          jurisdiction: options.state || 'DE',
          currency: options.currency || 'USD',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      // Add common stock/units
      model.securityClasses.push({
        id: 'sc_common',
        kind: 'COMMON',
        label: isCorp ? 'Common Stock' : 'Common Units',
        authorized: Number(options.authorized || defaults.authorized),
        parValue: isCorp ? Number(options.par ?? defaults.parValue) : undefined,
      });

      // Parse and add founders
      let totalFounderShares = 0;
      if (options.founder) {
        for (const founderStr of options.founder) {
          const founder = parseFounderString(founderStr);
          const stakeholder = {
            id: `sh_${randomUUID()}`,
            name: founder.name,
            type: 'person' as const,
            email: founder.email,
          };
          model.stakeholders.push(stakeholder);

          if (founder.shares > 0) {
            model.issuances.push({
              id: `is_${randomUUID()}`,
              securityClassId: 'sc_common',
              stakeholderId: stakeholder.id,
              qty: founder.shares,
              date: options.date || new Date().toISOString().slice(0, 10),
            });
            totalFounderShares += founder.shares;
          }
        }
      }

      // Add option pool if specified
      if ((options.pool || options.poolPct) && isCorp) {
        const poolSize = options.poolPct
          ? calculatePoolFromPercentage(totalFounderShares, Number(options.poolPct))
          : Number(options.pool);

        if (poolSize > 0) {
          model.securityClasses.push({
            id: 'sc_pool',
            kind: 'OPTION_POOL',
            label: 'Option Pool',
            authorized: poolSize,
          });
        }
      }
    }

    // Add audit log entry
    const auditService = new AuditService(model);
    auditService.logAction('INIT', { company: model.company.name });

    // Save model
    store.save(model);

    return {
      success: true,
      message: `✅ Created captable.json for "${model.company.name}"`,
      data: model,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleStakeholder(options: StakeholderOptions): CommandResult {
  try {
    const model = store.load();
    const stakeholderService = new StakeholderService(model);
    const auditService = new AuditService(model);

    const stakeholder = stakeholderService.addStakeholder(
      options.name,
      options.entity ? 'entity' : 'person',
      options.email
    );

    auditService.logAction('STAKEHOLDER_ADDED', { name: stakeholder.name, type: stakeholder.type });
    store.save(model);

    return {
      success: true,
      message: `✅ Added stakeholder "${stakeholder.name}" (${stakeholder.id})`,
      data: stakeholder,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to add stakeholder: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleIssue(options: IssueOptions): CommandResult {
  try {
    const model = store.load();
    const equityService = new EquityService(model);
    const securityService = new SecurityService(model);
    const stakeholderService = new StakeholderService(model);
    const auditService = new AuditService(model);

    const securityClassId = options.securityClass || securityService.listByKind('COMMON')[0]?.id;

    if (!securityClassId) {
      throw new Error('No common stock/units class found');
    }

    const issuance = equityService.issueShares(
      securityClassId,
      options.stakeholder,
      Number(options.qty),
      options.price ? Number(options.price) : undefined,
      options.date
    );

    const stakeholder = stakeholderService.getStakeholder(options.stakeholder);
    const securityClass = securityService.getSecurityClass(securityClassId);

    auditService.logAction('SHARES_ISSUED', {
      stakeholder: stakeholder?.name || options.stakeholder,
      qty: issuance.qty,
      class: securityClass?.label || 'shares',
    });

    store.save(model);

    return {
      success: true,
      message: `✅ Issued ${issuance.qty.toLocaleString()} ${securityClass?.label} to ${stakeholder?.name}`,
      data: issuance,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to issue shares: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleGrant(options: GrantOptions): CommandResult {
  try {
    const model = store.load();
    const equityService = new EquityService(model);
    const securityService = new SecurityService(model);
    const stakeholderService = new StakeholderService(model);
    const auditService = new AuditService(model);

    const poolId = options.pool || securityService.listByKind('OPTION_POOL')[0]?.id;

    if (!poolId) {
      throw new Error('No option pool found. Create one with "security:add --kind pool"');
    }

    const vesting: Vesting | undefined = options.vestMonths
      ? {
          monthsTotal: Number(options.vestMonths),
          cliffMonths: Number(options.vestCliff || 0),
          start: options.vestStart || options.date || new Date().toISOString().slice(0, 10),
        }
      : undefined;

    const grant = equityService.grantOptions(
      options.stakeholder,
      Number(options.qty),
      Number(options.exercise),
      options.date,
      vesting
    );

    const stakeholder = stakeholderService.getStakeholder(options.stakeholder);
    auditService.logAction('OPTIONS_GRANTED', {
      stakeholder: stakeholder?.name || options.stakeholder,
      qty: grant.qty,
      exercise: grant.exercise,
    });

    store.save(model);

    return {
      success: true,
      message: `✅ Granted ${grant.qty.toLocaleString()} options to ${stakeholder?.name} at $${grant.exercise}/share`,
      data: grant,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to grant options: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleSAFE(options: SAFEOptions): CommandResult {
  try {
    const model = store.load();
    const safeService = new SAFEService(model);
    const stakeholderService = new StakeholderService(model);
    const auditService = new AuditService(model);

    const safe = safeService.addSAFE({
      stakeholderId: options.stakeholder,
      amount: Number(options.amount),
      cap: options.cap ? Number(options.cap) : undefined,
      discount: options.discount ? 1 - Number(options.discount) / 100 : undefined,
      type: options.postMoney ? 'post' : undefined,
      date: options.date,
      note: options.note,
    });

    const stakeholder = stakeholderService.getStakeholder(options.stakeholder);
    auditService.logAction('SAFE_ADDED', {
      stakeholder: stakeholder?.name || options.stakeholder,
      amount: safe.amount,
      cap: safe.cap,
      discount: safe.discount,
    });

    store.save(model);

    const terms: string[] = [];
    if (safe.cap) terms.push(`cap: $${safe.cap.toLocaleString()}`);
    if (safe.discount) terms.push(`discount: ${Math.round((1 - safe.discount) * 100)}%`);

    return {
      success: true,
      message: `✅ Added SAFE for ${stakeholder?.name}: $${safe.amount.toLocaleString()}${
        terms.length ? ` (${terms.join(', ')})` : ''
      }`,
      data: safe,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to add SAFE: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleChart(options: ChartOptions): CommandResult {
  try {
    const model = store.load();
    const reportingService = new ReportingService(model);
    const capTable = reportingService.generateCapTable(options.date);

    // Format the cap table as a chart
    const lines: string[] = [
      `📊 Cap Table Summary - ${model.company.name}`,
      `As of: ${options.date || new Date().toISOString().slice(0, 10)}`,
      '',
      'Name'.padEnd(25) + 'Outstanding'.padStart(15) + '  %'.padStart(8),
      '─'.repeat(48),
    ];

    for (const row of capTable.rows) {
      lines.push(
        row.name.padEnd(25) +
          row.outstanding.toLocaleString().padStart(15) +
          (row.pctOutstanding * 100).toFixed(2).padStart(7) +
          '%'
      );
    }

    lines.push('─'.repeat(48));
    lines.push(
      'Total'.padEnd(25) +
        capTable.totals.outstandingTotal.toLocaleString().padStart(15) +
        ' 100.00%'
    );

    return {
      success: true,
      message: lines.join('\n'),
      data: capTable,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to generate chart: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleExport(format: string, options: ExportOptions): CommandResult {
  try {
    const model = store.load();
    const reportingService = new ReportingService(model);

    let output: string;
    switch (format) {
      case 'json':
        output = reportingService.exportJSON();
        break;
      case 'csv':
        output = reportingService.exportCSV(options.includeOptions !== false);
        break;
      case 'summary':
        output = reportingService.generateSummary();
        break;
      default:
        throw new Error(`Unknown export format: ${format}`);
    }

    return {
      success: true,
      message: output,
      data: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to export: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleReport(options: ReportOptions): CommandResult {
  try {
    const model = store.load();
    const reportingService = new ReportingService(model);

    let output: string;
    switch (options.type) {
      case 'stakeholder':
        output = reportingService.generateStakeholderReport(options.id);
        break;
      case 'class':
      case 'security':
        output = reportingService.generateSecurityClassReport(options.id);
        break;
      case 'summary': {
        // Generate a full cap table summary report
        const capTable = reportingService.generateCapTable();
        const lines: string[] = [
          `📊 Cap Table Summary - ${model.company.name}`,
          `As of: ${new Date().toISOString().slice(0, 10)}`,
          '',
          'Stakeholder'.padEnd(25) + 'Outstanding'.padStart(15) + '  %'.padStart(8),
          '─'.repeat(48),
        ];
        for (const row of capTable.rows) {
          lines.push(
            row.name.padEnd(25) +
              row.outstanding.toLocaleString().padStart(15) +
              (row.pctOutstanding * 100).toFixed(2).padStart(7) +
              '%'
          );
        }
        lines.push('─'.repeat(48));
        lines.push(
          'Total Outstanding'.padEnd(25) +
            capTable.totals.outstandingTotal.toLocaleString().padStart(15) +
            '  100.00%'
        );
        lines.push('');
        lines.push(
          'Fully Diluted:'.padEnd(25) + capTable.totals.fd.totalFD.toLocaleString().padStart(15)
        );
        output = lines.join('\n');
        break;
      }
      default:
        throw new Error(`Unknown report type: ${options.type}`);
    }

    return {
      success: true,
      message: output,
      data: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to generate report: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleLog(options: LogOptions): CommandResult {
  try {
    const model = store.load();
    const auditService = new AuditService(model);
    const limit = options.limit ? Number(options.limit) : 20;
    let logs = auditService.getRecentActions(limit);

    // Filter by action if specified
    if (options.action) {
      logs = logs.filter((log) => log.action === options.action);
    }

    const output = ['📋 Audit Log', ''];
    for (const log of logs) {
      const timestamp = new Date(log.ts).toLocaleString();
      const details = log.data ? JSON.stringify(log.data) : '';
      output.push(`[${timestamp}] ${log.action}: ${details}`);
    }

    if (logs.length === 0) {
      output.push(
        options.action ? `No audit logs found for action: ${options.action}` : 'No audit logs found'
      );
    }

    return {
      success: true,
      message: output.join('\n'),
      data: logs,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleList(options: ListOptions): CommandResult {
  try {
    const model = store.load();
    const output: string[] = [];

    switch (options.type) {
      case 'stakeholders': {
        const stakeholderService = new StakeholderService(model);
        const stakeholders = stakeholderService.listStakeholders();
        output.push('📋 Stakeholders\n');
        for (const sh of stakeholders) {
          output.push(`  ${sh.name} (${sh.id}) - ${sh.type}${sh.email ? ` - ${sh.email}` : ''}`);
        }
        if (stakeholders.length === 0) {
          output.push('  No stakeholders found');
        }
        break;
      }
      case 'classes': {
        const securityService = new SecurityService(model);
        const classes = securityService.listSecurityClasses();
        output.push('📋 Security Classes\n');
        for (const sc of classes) {
          output.push(
            `  ${sc.label} (${sc.id}) - ${sc.kind} - Authorized: ${sc.authorized.toLocaleString()}${
              sc.parValue !== undefined ? ` - Par: $${sc.parValue}` : ''
            }`
          );
        }
        if (classes.length === 0) {
          output.push('  No security classes found');
        }
        break;
      }
      case 'safes': {
        const safeService = new SAFEService(model);
        const stakeholderService = new StakeholderService(model);
        const safes = safeService.listSAFEs();
        output.push('📋 SAFEs\n');
        for (const safe of safes) {
          const stakeholder = stakeholderService.getStakeholder(safe.stakeholderId);
          const terms: string[] = [];
          if (safe.cap) terms.push(`Cap: $${safe.cap.toLocaleString()}`);
          if (safe.discount) terms.push(`Discount: ${Math.round((1 - safe.discount) * 100)}%`);
          output.push(
            `  ${stakeholder?.name || safe.stakeholderId}: $${safe.amount.toLocaleString()}${
              terms.length ? ` (${terms.join(', ')})` : ''
            } - ${safe.date}`
          );
        }
        if (safes.length === 0) {
          output.push('  No SAFEs found');
        }
        break;
      }
      default:
        throw new Error(`Unknown list type: ${options.type}`);
    }

    return {
      success: true,
      message: output.join('\n'),
      data: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to list: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleEnlist(): CommandResult {
  try {
    const model = store.load();
    const stakeholderService = new StakeholderService(model);
    const stakeholders = stakeholderService.listStakeholders();
    const output = stakeholders.map((sh) => `${sh.id}\t${sh.name}`).join('\n');

    return {
      success: true,
      message: output || 'No stakeholders found',
      data: stakeholders,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to list stakeholders: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleConvert(options: ConvertOptions): CommandResult {
  try {
    const model = store.load();
    const safeService = new SAFEService(model);
    const stakeholderService = new StakeholderService(model);

    // Check if there are any SAFEs to convert
    if (model.safes.length === 0) {
      return {
        success: false,
        message: '❌ No SAFEs to convert',
      };
    }

    // Calculate price per share if not provided directly
    let pricePerShare: number;
    if (options.price) {
      pricePerShare = Number(options.price);
    } else if (options.preMoney) {
      // Calculate price from pre-money valuation
      const preMoneyValuation = Number(options.preMoney);
      const currentShares = model.issuances.reduce((sum, issuance) => {
        const securityClass = model.securityClasses.find(
          (sc) => sc.id === issuance.securityClassId
        );
        if (securityClass && securityClass.kind !== 'OPTION_POOL') {
          return sum + issuance.qty;
        }
        return sum;
      }, 0);
      pricePerShare = currentShares > 0 ? preMoneyValuation / currentShares : 1;
    } else {
      throw new Error('Must provide either --price or --pre-money');
    }

    // Simulate conversion to get the results
    const conversions = safeService.simulateConversion({
      preMoneyValuation: options.preMoney ? Number(options.preMoney) : 0,
      newMoneyRaised: options.newMoney ? Number(options.newMoney) : 0,
      pricePerShare,
    });

    // Calculate ownership percentages
    const currentShares = model.issuances.reduce((sum, issuance) => {
      const securityClass = model.securityClasses.find((sc) => sc.id === issuance.securityClassId);
      if (securityClass && securityClass.kind !== 'OPTION_POOL') {
        return sum + issuance.qty;
      }
      return sum;
    }, 0);

    const totalNewShares = conversions.reduce((sum, c) => sum + c.sharesIssued, 0);
    const postMoneyShares = currentShares + totalNewShares;
    const dilution = (totalNewShares / postMoneyShares) * 100;

    if (options.dryRun) {
      // Preview mode - don't actually convert
      const output: string[] = ['🔄 SAFE Conversion Preview\n'];

      for (const conversion of conversions) {
        const stakeholder = stakeholderService.getStakeholder(conversion.stakeholderId);
        const safe = model.safes.find((s) => s.stakeholderId === conversion.stakeholderId);
        const ownershipPct = (conversion.sharesIssued / postMoneyShares) * 100;

        output.push(`${stakeholder?.name || conversion.stakeholderId}:`);
        output.push(`  Investment: $${safe?.amount.toLocaleString()}`);
        output.push(
          `  Shares: ${conversion.sharesIssued.toLocaleString()} at $${conversion.conversionPrice.toFixed(2)}/share (${conversion.conversionReason})`
        );
        output.push(`  New ownership: ${ownershipPct.toFixed(2)}%`);
        output.push('');
      }

      output.push(`Total new shares: ${totalNewShares.toLocaleString()}`);
      output.push(`Post-money shares: ${postMoneyShares.toLocaleString()}`);
      output.push(`Dilution to existing: ${dilution.toFixed(2)}%`);

      return {
        success: true,
        message: output.join('\n'),
        data: { conversions, totalNewShares, postMoneyShares, dilution },
      };
    } else {
      // Actual conversion mode - execute the conversion
      const securityService = new SecurityService(model);
      const equityService = new EquityService(model);
      const commonClasses = securityService.listByKind('COMMON');

      if (commonClasses.length === 0) {
        throw new Error('No common stock class found for SAFE conversion');
      }

      const commonClass = commonClasses[0];
      const issuedConversions: Array<{
        stakeholderId: string;
        sharesIssued: number;
        conversionPrice: number;
        conversionReason: string;
      }> = [];

      for (const conversion of conversions) {
        // Issue shares for the conversion
        equityService.issueShares(
          commonClass.id,
          conversion.stakeholderId,
          conversion.sharesIssued,
          conversion.conversionPrice,
          options.date
        );

        issuedConversions.push({
          stakeholderId: conversion.stakeholderId,
          sharesIssued: conversion.sharesIssued,
          conversionPrice: conversion.conversionPrice,
          conversionReason: conversion.conversionReason,
        });
      }

      // Remove converted SAFEs
      model.safes = [];

      const output: string[] = ['🔄 SAFE Conversions Executed\n'];
      for (const conversion of issuedConversions) {
        const stakeholder = stakeholderService.getStakeholder(conversion.stakeholderId);
        const ownershipPct = (conversion.sharesIssued / postMoneyShares) * 100;
        output.push(
          `  ${stakeholder?.name || conversion.stakeholderId}: ${conversion.sharesIssued.toLocaleString()} shares at $${conversion.conversionPrice.toFixed(2)}/share (${conversion.conversionReason}) - ${ownershipPct.toFixed(2)}% ownership`
        );
      }

      output.push(`\nTotal dilution: ${dilution.toFixed(2)}%`);

      store.save(model);

      return {
        success: true,
        message: output.join('\n'),
        data: issuedConversions,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to convert SAFEs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleSecurityAdd(
  kind: string,
  label: string,
  authorized: string,
  parValue?: string
): CommandResult {
  try {
    const model = store.load();
    const securityService = new SecurityService(model);
    const auditService = new AuditService(model);

    const kindMap: Record<string, string> = {
      common: 'COMMON',
      preferred: 'PREF',
      pool: 'OPTION_POOL',
    };

    const mappedKind = kindMap[kind.toLowerCase()] || kind;
    const securityClass = securityService.addSecurityClass(
      mappedKind as 'COMMON' | 'PREF' | 'OPTION_POOL',
      label,
      Number(authorized),
      parValue ? Number(parValue) : undefined
    );

    auditService.logAction('SECURITY_CLASS_ADDED', {
      label,
      kind: mappedKind,
      authorized: Number(authorized),
    });
    store.save(model);

    return {
      success: true,
      message: `✅ Added security class "${label}" (${securityClass.id})`,
      data: securityClass,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to add security class: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function handleSafes(): CommandResult {
  try {
    const model = store.load();
    const safeService = new SAFEService(model);
    const stakeholderService = new StakeholderService(model);
    const safes = safeService.listSAFEs();

    const output: string[] = ['📋 SAFEs Outstanding\n'];
    let totalAmount = 0;

    for (const safe of safes) {
      const stakeholder = stakeholderService.getStakeholder(safe.stakeholderId);
      const terms: string[] = [];
      if (safe.cap) terms.push(`Cap: $${safe.cap.toLocaleString()}`);
      if (safe.discount) terms.push(`Discount: ${Math.round((1 - safe.discount) * 100)}%`);
      if (safe.type === 'post') terms.push('Post-money');

      output.push(
        `  ${stakeholder?.name || safe.stakeholderId}:`,
        `    Amount: $${safe.amount.toLocaleString()}`,
        `    Terms: ${terms.join(', ') || 'None'}`,
        `    Date: ${safe.date}`,
        safe.note ? `    Note: ${safe.note}` : '',
        ''
      );

      totalAmount += safe.amount;
    }

    if (safes.length > 0) {
      output.push(`Total: $${totalAmount.toLocaleString()} across ${safes.length} SAFEs`);
    } else {
      output.push('No SAFEs outstanding');
    }

    return {
      success: true,
      message: output.filter(Boolean).join('\n'),
      data: safes,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to list SAFEs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
