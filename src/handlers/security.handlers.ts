/**
 * Security Class Resource Handlers
 *
 * Handles all security class-related commands:
 * - add: Create a new security class
 * - list: List all security classes
 * - show: Show security class details
 * - update: Update security class information
 * - delete: Remove a security class
 */

import * as helpers from '../services/helpers.js';
import { load, save } from '../store.js';
import type { HandlerResult } from './types.js';

export function handleSecurityAdd(opts: {
  kind: string;
  label: string;
  authorized?: string;
  par?: string;
}): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    const kind = opts.kind.toUpperCase();
    if (!['COMMON', 'PREFERRED', 'OPTION_POOL'].includes(kind)) {
      return {
        success: false,
        message: '❌ Invalid security kind. Must be COMMON, PREFERRED, or OPTION_POOL.',
      };
    }

    const authorized = parseInt(opts.authorized || '10000000');
    const par = opts.par ? parseFloat(opts.par) : undefined;

    const security = helpers.createSecurityClass(kind as any, opts.label, authorized, par);

    captable.securityClasses.push(security);

    helpers.logAction(captable, {
      action: 'SECURITY_ADD',
      entity: 'security',
      entityId: security.id,
      details: `Added ${kind} security class: ${opts.label} (${authorized.toLocaleString()} authorized)`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Added security class "${opts.label}" (${security.id})`,
      data: security,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSecurityList(opts: { format?: string }): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    if (opts.format === 'json') {
      return {
        success: true,
        message: JSON.stringify(captable.securityClasses, null, 2),
        data: captable.securityClasses,
      };
    }

    // Table format
    if (captable.securityClasses.length === 0) {
      return {
        success: true,
        message: 'No security classes found.',
      };
    }

    let output = '🏦 Security Classes\n\n';
    output += 'ID              Type          Label                     Authorized        Issued\n';
    output += '─'.repeat(85) + '\n';

    for (const sc of captable.securityClasses) {
      const issued = helpers.getIssuedShares(captable, sc.id);
      const id = sc.id.padEnd(14);
      const type = sc.kind.padEnd(12);
      const label = sc.label.substring(0, 22).padEnd(22);
      const auth = sc.authorized.toLocaleString().padStart(14);
      const iss = issued.toLocaleString().padStart(14);
      output += `${id}  ${type}  ${label}  ${auth}  ${iss}\n`;
    }

    return {
      success: true,
      message: output,
      data: captable.securityClasses,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSecurityShow(id: string | undefined, _opts: any): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a security class ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const security = captable.securityClasses.find((sc) => sc.id === id);
    if (!security) {
      return {
        success: false,
        message: `❌ Security class not found: ${id}`,
      };
    }

    const issued = helpers.getIssuedShares(captable, security.id);
    const available = security.authorized - issued;
    const utilization =
      security.authorized > 0 ? ((issued / security.authorized) * 100).toFixed(1) : '0.0';

    let output = `\n🏦 Security Class Details\n\n`;
    output += `Label:      ${security.label}\n`;
    output += `ID:         ${security.id}\n`;
    output += `Type:       ${security.kind}\n`;
    output += `Authorized: ${security.authorized.toLocaleString()}\n`;
    output += `Issued:     ${issued.toLocaleString()}\n`;
    output += `Available:  ${available.toLocaleString()}\n`;
    output += `Utilization: ${utilization}%\n`;

    if (security.parValue !== undefined) {
      output += `Par Value:  $${security.parValue}\n`;
    }

    // Show issuances
    const issuances = captable.issuances.filter((i) => i.securityClassId === security.id);
    if (issuances.length > 0) {
      output += `\n📊 Issuances:\n`;
      issuances.forEach((iss) => {
        const holder = captable.stakeholders.find((sh) => sh.id === iss.stakeholderId);
        output += `  • ${iss.qty.toLocaleString()} shares to ${holder?.name || 'Unknown'}`;
        if (iss.pps) {
          // Fixed: pricePerShare -> pps
          output += ` at $${iss.pps}/share`;
        }
        output += `\n`;
      });
    }

    return {
      success: true,
      message: output,
      data: { security, issued, available },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSecurityUpdate(
  id: string | undefined,
  opts: { authorized?: string; label?: string }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a security class ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const security = captable.securityClasses.find((sc) => sc.id === id);
    if (!security) {
      return {
        success: false,
        message: `❌ Security class not found: ${id}`,
      };
    }

    const updates: string[] = [];

    if (opts.authorized !== undefined) {
      const newAuthorized = parseInt(opts.authorized);
      const issued = helpers.getIssuedShares(captable, security.id);

      if (newAuthorized < issued) {
        return {
          success: false,
          message: `❌ Cannot set authorized (${newAuthorized.toLocaleString()}) below issued (${issued.toLocaleString()})`,
        };
      }

      security.authorized = newAuthorized;
      updates.push(`authorized to ${newAuthorized.toLocaleString()}`);
    }

    if (opts.label) {
      security.label = opts.label;
      updates.push(`label to "${opts.label}"`);
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: '❌ No updates provided. Use --authorized or --label to update.',
      };
    }

    helpers.logAction(captable, {
      action: 'SECURITY_UPDATE',
      entity: 'security',
      entityId: security.id,
      details: `Updated ${updates.join(' and ')}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Updated security class "${security.label}" (${security.id})`,
      data: security,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSecurityDelete(
  id: string | undefined,
  opts: { force?: boolean }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a security class ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const index = captable.securityClasses.findIndex((sc) => sc.id === id);
    if (index === -1) {
      return {
        success: false,
        message: `❌ Security class not found: ${id}`,
      };
    }

    const security = captable.securityClasses[index];
    const issued = helpers.getIssuedShares(captable, security.id);

    if (issued > 0 && !opts.force) {
      return {
        success: false,
        message: `❌ Security class has ${issued.toLocaleString()} issued shares. Use --force to delete anyway.`,
      };
    }

    captable.securityClasses.splice(index, 1);

    // If forced, also remove all related issuances
    if (opts.force) {
      captable.issuances = captable.issuances.filter((i) => i.securityClassId !== security.id);

      // For option pools, also remove grants
      // Note: optionPoolId doesn't exist in the model, so we can't filter by it
      // Instead, when deleting an option pool, we should remove all grants if it's the only pool
      if (security.kind === 'OPTION_POOL') {
        const remainingPools = captable.securityClasses.filter((sc) => sc.kind === 'OPTION_POOL');
        if (remainingPools.length === 0) {
          // No more pools, remove all grants
          captable.optionGrants = [];
        }
      }
    }

    helpers.logAction(captable, {
      action: 'SECURITY_DELETE',
      entity: 'security',
      entityId: security.id,
      details: `Deleted security class: ${security.label}${opts.force ? ' (forced, removed all issuances)' : ''}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Deleted security class "${security.label}" (${security.id})`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}
