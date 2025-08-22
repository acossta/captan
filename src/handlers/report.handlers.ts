/**
 * Report Resource Handlers
 *
 * Handles all reporting commands:
 * - summary: Generate comprehensive summary
 * - ownership: Show ownership breakdown
 * - stakeholder: Generate stakeholder report
 * - security: Generate security class report
 */

import { resolveStakeholder } from '../identifier-resolver.js';
import * as helpers from '../services/helpers.js';
import { load } from '../store.js';
import { getCurrentDate } from '../utils/date-utils.js';
import type { HandlerResult } from './types.js';

export function handleReportSummary(opts: { format?: string }): HandlerResult {
  try {
    const captable = load('captable.json');

    if (opts.format === 'json') {
      const summary = {
        company: captable.company,
        stakeholders: captable.stakeholders.length,
        securityClasses: captable.securityClasses.length,
        issuances: captable.issuances?.length || 0,
        grants: captable.optionGrants?.length || 0,
        safes: captable.safes?.length || 0,
        totalShares: captable.issuances?.reduce((sum, i) => sum + i.qty, 0) || 0,
        totalOptions: captable.optionGrants?.reduce((sum, g) => sum + g.qty, 0) || 0,
        totalSafes: captable.safes?.reduce((sum, s) => sum + s.amount, 0) || 0,
      };
      return {
        success: true,
        message: JSON.stringify(summary, null, 2),
        data: summary,
      };
    }

    // Table format
    let output = `\n📊 Cap Table Summary\n\n`;
    output += `Company: ${captable.company.name}\n`;
    output += `Type: ${captable.company.entityType}\n`;
    output += `State: ${captable.company.jurisdiction || 'Not specified'}\n`;
    output += `Formed: ${captable.company.formationDate}\n\n`;

    output += `📈 Statistics:\n`;
    output += `  Stakeholders: ${captable.stakeholders.length}\n`;
    output += `  Security Classes: ${captable.securityClasses.length}\n`;
    output += `  Share Issuances: ${captable.issuances?.length || 0}\n`;
    output += `  Option Grants: ${captable.optionGrants?.length || 0}\n`;
    output += `  SAFEs: ${captable.safes?.length || 0}\n\n`;

    const totalShares = captable.issuances?.reduce((sum, i) => sum + i.qty, 0) || 0;
    const totalOptions = captable.optionGrants?.reduce((sum, g) => sum + g.qty, 0) || 0;
    const totalSafes = captable.safes?.reduce((sum, s) => sum + s.amount, 0) || 0;

    output += `💰 Totals:\n`;
    output += `  Issued Shares: ${totalShares.toLocaleString('en-US')}\n`;
    output += `  Granted Options: ${totalOptions.toLocaleString('en-US')}\n`;
    output += `  SAFE Investment: $${totalSafes.toLocaleString('en-US')}\n`;

    return {
      success: true,
      message: output,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleReportOwnership(opts: { date?: string; format?: string }): HandlerResult {
  try {
    const captable = load('captable.json');

    const asOfDate = opts.date || getCurrentDate();

    // Calculate ownership for each stakeholder
    const ownership = captable.stakeholders
      .map((sh) => {
        const issuances = captable.issuances?.filter((i) => i.stakeholderId === sh.id) || [];
        const shares = issuances.reduce((sum, i) => sum + i.qty, 0);

        const grants = captable.optionGrants?.filter((g) => g.stakeholderId === sh.id) || [];
        const vestedOptions = grants.reduce((sum, g) => {
          const vested = g.vesting ? helpers.calculateVestedOptions(g, asOfDate) : g.qty;
          return sum + vested;
        }, 0);

        const outstanding = shares + vestedOptions;

        return {
          stakeholder: sh,
          shares,
          vestedOptions,
          outstanding,
        };
      })
      .filter((o) => o.outstanding > 0);

    const totalOutstanding = ownership.reduce((sum, o) => sum + o.outstanding, 0);

    if (opts.format === 'json') {
      return {
        success: true,
        message: JSON.stringify(ownership, null, 2),
        data: ownership,
      };
    }

    // Table format
    let output = `\n📊 Ownership Table (as of ${asOfDate})\n\n`;
    output += 'Name                          Shares        Options      Outstanding     %\n';
    output += '─'.repeat(80) + '\n';

    ownership
      .sort((a, b) => b.outstanding - a.outstanding)
      .forEach((o) => {
        const name = o.stakeholder.name.substring(0, 28).padEnd(28);
        const shares = o.shares.toLocaleString('en-US').padStart(12);
        const options = o.vestedOptions.toLocaleString('en-US').padStart(12);
        const outstanding = o.outstanding.toLocaleString('en-US').padStart(14);
        const pct =
          totalOutstanding > 0
            ? ((o.outstanding / totalOutstanding) * 100).toFixed(2).padStart(7)
            : '0.00'.padStart(7);

        output += `${name}  ${shares}  ${options}  ${outstanding}  ${pct}%\n`;
      });

    output += '─'.repeat(80) + '\n';
    output += `${'Total'.padEnd(28)}  ${' '.repeat(12)}  ${' '.repeat(12)}  ${totalOutstanding.toLocaleString('en-US').padStart(14)}  100.00%\n`;

    return {
      success: true,
      message: output,
      data: ownership,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleReportStakeholder(idOrEmail: string | undefined, _opts: any): HandlerResult {
  try {
    if (!idOrEmail) {
      return {
        success: false,
        message: '❌ Please provide a stakeholder ID or email',
      };
    }

    const result = resolveStakeholder(idOrEmail);
    if (!result.success || !result.stakeholder) {
      return {
        success: false,
        message: `❌ ${result.error}`,
      };
    }

    const captable = load('captable.json');

    const holdings = helpers.getStakeholderHoldings(captable, result.stakeholder.id);
    const today = getCurrentDate();

    let output = `\n📋 Stakeholder Report: ${result.stakeholder.name}\n\n`;
    output += `ID: ${result.stakeholder.id}\n`;
    if (result.stakeholder.email) {
      output += `Email: ${result.stakeholder.email}\n`;
    }
    output += `Type: ${result.stakeholder.type === 'entity' ? 'ENTITY' : 'PERSON'}\n\n`;

    // Share issuances
    if (holdings.issuances.length > 0) {
      output += `📊 Share Issuances (${holdings.issuances.length}):\n`;
      let totalShares = 0;
      holdings.issuances.forEach((iss) => {
        const security = captable.securityClasses.find((sc) => sc.id === iss.securityClassId);
        output += `  • ${iss.date}: ${iss.qty.toLocaleString('en-US')} ${security?.label || 'shares'}`;
        if (iss.pps) {
          // Fixed: pricePerShare -> pps
          output += ` at $${iss.pps}/share`;
        }
        output += '\n';
        totalShares += iss.qty;
      });
      output += `  Total: ${totalShares.toLocaleString('en-US')} shares\n\n`;
    }

    // Option grants
    if (holdings.grants.length > 0) {
      output += `🎯 Option Grants (${holdings.grants.length}):\n`;
      let totalOptions = 0;
      let totalVested = 0;
      holdings.grants.forEach((grant) => {
        const vested = grant.vesting ? helpers.calculateVestedOptions(grant, today) : grant.qty;
        output += `  • ${grant.grantDate}: ${grant.qty.toLocaleString('en-US')} options at $${grant.exercise}`;
        if (grant.vesting) {
          output += ` (${vested.toLocaleString('en-US')} vested)`;
        }
        output += '\n';
        totalOptions += grant.qty;
        totalVested += vested;
      });
      output += `  Total: ${totalOptions.toLocaleString('en-US')} granted, ${totalVested.toLocaleString('en-US')} vested\n\n`;
    }

    // SAFEs
    if (holdings.safes.length > 0) {
      output += `💰 SAFE Investments (${holdings.safes.length}):\n`;
      let totalInvestment = 0;
      holdings.safes.forEach((safe) => {
        output += `  • ${safe.date}: $${safe.amount.toLocaleString('en-US')}`;
        const terms: string[] = [];
        if (safe.cap) terms.push(`$${safe.cap.toLocaleString('en-US')} cap`);
        if (safe.discount) terms.push(`${(safe.discount * 100).toFixed(0)}% discount`);
        if (terms.length > 0) {
          output += ` (${terms.join(', ')})`;
        }
        output += '\n';
        totalInvestment += safe.amount;
      });
      output += `  Total: $${totalInvestment.toLocaleString('en-US')}\n`;
    }

    if (
      holdings.issuances.length === 0 &&
      holdings.grants.length === 0 &&
      holdings.safes.length === 0
    ) {
      output += `No equity holdings found.\n`;
    }

    return {
      success: true,
      message: output,
      data: holdings,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleReportSecurity(id: string | undefined, _opts: any): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a security class ID',
      };
    }

    const captable = load('captable.json');

    const security = captable.securityClasses.find((sc) => sc.id === id);
    if (!security) {
      return {
        success: false,
        message: `❌ Security class not found: ${id}`,
      };
    }

    let output = `\n🏦 Security Class Report: ${security.label}\n\n`;
    output += `ID: ${security.id}\n`;
    output += `Type: ${security.kind}\n`;
    output += `Authorized: ${security.authorized.toLocaleString('en-US')}\n`;
    if (security.parValue !== undefined) {
      output += `Par Value: $${security.parValue}\n`;
    }
    output += '\n';

    if (security.kind === 'OPTION_POOL') {
      // Option pool report
      // Note: optionPoolId is not tracked in the model, so we assume all grants come from this pool
      const grants = captable.optionGrants || [];
      const totalGranted = grants.reduce((sum, g) => sum + g.qty, 0);
      const remaining = security.authorized - totalGranted;
      const utilization =
        security.authorized > 0 ? ((totalGranted / security.authorized) * 100).toFixed(1) : '0.0';

      output += `📊 Pool Utilization:\n`;
      output += `  Granted: ${totalGranted.toLocaleString('en-US')}\n`;
      output += `  Remaining: ${remaining.toLocaleString('en-US')}\n`;
      output += `  Utilization: ${utilization}%\n\n`;

      if (grants.length > 0) {
        output += `🎯 Grants (${grants.length}):\n`;
        grants.forEach((grant) => {
          const holder = captable.stakeholders.find((sh) => sh.id === grant.stakeholderId);
          output += `  • ${holder?.name || 'Unknown'}: ${grant.qty.toLocaleString('en-US')} at $${grant.exercise}\n`;
        });
      }
    } else {
      // Regular security class report
      const issuances = captable.issuances?.filter((i) => i.securityClassId === security.id) || [];
      const totalIssued = issuances.reduce((sum, i) => sum + i.qty, 0);
      const remaining = security.authorized - totalIssued;
      const utilization =
        security.authorized > 0 ? ((totalIssued / security.authorized) * 100).toFixed(1) : '0.0';

      output += `📊 Share Utilization:\n`;
      output += `  Issued: ${totalIssued.toLocaleString('en-US')}\n`;
      output += `  Remaining: ${remaining.toLocaleString('en-US')}\n`;
      output += `  Utilization: ${utilization}%\n\n`;

      if (issuances.length > 0) {
        output += `📈 Issuances (${issuances.length}):\n`;
        issuances.forEach((iss) => {
          const holder = captable.stakeholders.find((sh) => sh.id === iss.stakeholderId);
          output += `  • ${holder?.name || 'Unknown'}: ${iss.qty.toLocaleString('en-US')}`;
          if (iss.pps) {
            // Fixed: pricePerShare -> pps
            output += ` at $${iss.pps}/share`;
          }
          output += '\n';
        });
      }
    }

    return {
      success: true,
      message: output,
      data: { security },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}
