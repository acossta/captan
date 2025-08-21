/**
 * Issuance Resource Handlers
 *
 * Handles all share issuance-related commands:
 * - add: Issue new shares
 * - list: List all issuances
 * - show: Show issuance details
 * - update: Update issuance information
 * - delete: Remove an issuance
 */

import { resolveStakeholder, formatStakeholderReference } from '../identifier-resolver.js';
import * as helpers from '../services/helpers.js';
import { load, save } from '../store.js';
import type { HandlerResult } from './types.js';

export function handleIssuanceAdd(opts: {
  stakeholder: string;
  security: string;
  qty: string;
  pps?: string;
  date?: string;
}): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    // Resolve stakeholder
    const stakeholderResult = resolveStakeholder(opts.stakeholder);
    if (!stakeholderResult.success || !stakeholderResult.stakeholder) {
      return {
        success: false,
        message: `❌ ${stakeholderResult.error}`,
      };
    }

    // Find security class
    const security = captable.securityClasses.find((sc) => sc.id === opts.security);
    if (!security) {
      return {
        success: false,
        message: `❌ Security class not found: ${opts.security}`,
      };
    }

    const qty = parseInt(opts.qty);
    const pricePerShare = opts.pps ? parseFloat(opts.pps) : undefined;
    const date = opts.date || new Date().toISOString().slice(0, 10);

    // Check authorized limit
    const currentIssued = helpers.getIssuedShares(captable, security.id);
    if (currentIssued + qty > security.authorized) {
      return {
        success: false,
        message: `❌ Issuance would exceed authorized shares. Available: ${(security.authorized - currentIssued).toLocaleString()}`,
      };
    }

    const issuance = helpers.createIssuance(
      stakeholderResult.stakeholder.id,
      security.id,
      qty,
      pricePerShare,
      date
    );

    captable.issuances.push(issuance);

    helpers.logAction(captable, {
      action: 'ISSUANCE_ADD',
      entity: 'issuance',
      entityId: issuance.id,
      details: `Issued ${qty.toLocaleString()} ${security.label} shares to ${stakeholderResult.stakeholder.name}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Issued ${qty.toLocaleString()} shares of ${security.label} to ${formatStakeholderReference(stakeholderResult.stakeholder)}`,
      data: issuance,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleIssuanceList(opts: { stakeholder?: string; format?: string }): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    let issuances = captable.issuances;

    // Filter by stakeholder if provided
    if (opts.stakeholder) {
      const stakeholderResult = resolveStakeholder(opts.stakeholder);
      if (!stakeholderResult.success || !stakeholderResult.stakeholder) {
        return {
          success: false,
          message: `❌ ${stakeholderResult.error}`,
        };
      }
      issuances = issuances.filter((i) => i.stakeholderId === stakeholderResult.stakeholder!.id);
    }

    if (opts.format === 'json') {
      return {
        success: true,
        message: JSON.stringify(issuances, null, 2),
        data: issuances,
      };
    }

    // Table format
    if (issuances.length === 0) {
      return {
        success: true,
        message: 'No issuances found.',
      };
    }

    let output = '📊 Share Issuances\n\n';
    output +=
      'ID              Date        Stakeholder                Security           Quantity      Price\n';
    output += '─'.repeat(95) + '\n';

    for (const iss of issuances) {
      const stakeholder = captable.stakeholders.find((sh) => sh.id === iss.stakeholderId);
      const security = captable.securityClasses.find((sc) => sc.id === iss.securityClassId);

      const id = iss.id.substring(0, 14).padEnd(14);
      const date = iss.date.padEnd(10);
      const holder = (stakeholder?.name || 'Unknown').substring(0, 24).padEnd(24);
      const sec = (security?.label || 'Unknown').substring(0, 16).padEnd(16);
      const qty = iss.qty.toLocaleString().padStart(12);
      const price = iss.pps ? `$${iss.pps}` : '-';

      output += `${id}  ${date}  ${holder}  ${sec}  ${qty}  ${price}\n`;
    }

    return {
      success: true,
      message: output,
      data: issuances,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleIssuanceShow(id: string | undefined, _opts: any): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide an issuance ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const issuance = captable.issuances.find((i) => i.id === id);
    if (!issuance) {
      return {
        success: false,
        message: `❌ Issuance not found: ${id}`,
      };
    }

    const stakeholder = captable.stakeholders.find((sh) => sh.id === issuance.stakeholderId);
    const security = captable.securityClasses.find((sc) => sc.id === issuance.securityClassId);

    let output = `\n📊 Issuance Details\n\n`;
    output += `ID:           ${issuance.id}\n`;
    output += `Date:         ${issuance.date}\n`;
    output += `Stakeholder:  ${stakeholder?.name || 'Unknown'} (${issuance.stakeholderId})\n`;
    output += `Security:     ${security?.label || 'Unknown'} (${issuance.securityClassId})\n`;
    output += `Quantity:     ${issuance.qty.toLocaleString()} shares\n`;

    if (issuance.pps !== undefined) {
      output += `Price/Share:  $${issuance.pps}\n`;
      output += `Total Value:  $${(issuance.qty * issuance.pps).toLocaleString()}\n`;
    }

    if (issuance.cert) {
      output += `Certificate:  ${issuance.cert}\n`;
    }

    return {
      success: true,
      message: output,
      data: issuance,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleIssuanceUpdate(
  id: string | undefined,
  opts: { qty?: string; pps?: string }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide an issuance ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const issuance = captable.issuances.find((i) => i.id === id);
    if (!issuance) {
      return {
        success: false,
        message: `❌ Issuance not found: ${id}`,
      };
    }

    const updates: string[] = [];
    const oldQty = issuance.qty;

    if (opts.qty !== undefined) {
      const newQty = parseInt(opts.qty);

      // Check if the new quantity would exceed authorized shares
      const security = captable.securityClasses.find((sc) => sc.id === issuance.securityClassId);
      if (security) {
        const currentIssued = helpers.getIssuedShares(captable, security.id);
        const newTotal = currentIssued - oldQty + newQty;

        if (newTotal > security.authorized) {
          return {
            success: false,
            message: `❌ Update would exceed authorized shares. Available: ${(security.authorized - currentIssued + oldQty).toLocaleString()}`,
          };
        }
      }

      issuance.qty = newQty;
      updates.push(`quantity to ${newQty.toLocaleString()}`);
    }

    if (opts.pps !== undefined) {
      const newPps = parseFloat(opts.pps);
      issuance.pps = newPps;
      updates.push(`price per share to $${newPps}`);
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: '❌ No updates provided. Use --qty or --pps to update.',
      };
    }

    helpers.logAction(captable, {
      action: 'ISSUANCE_UPDATE',
      entity: 'issuance',
      entityId: issuance.id,
      details: `Updated ${updates.join(' and ')}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Updated issuance ${issuance.id}`,
      data: issuance,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleIssuanceDelete(
  id: string | undefined,
  opts: { force?: boolean }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide an issuance ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const index = captable.issuances.findIndex((i) => i.id === id);
    if (index === -1) {
      return {
        success: false,
        message: `❌ Issuance not found: ${id}`,
      };
    }

    const issuance = captable.issuances[index];
    const stakeholder = captable.stakeholders.find((sh) => sh.id === issuance.stakeholderId);
    const security = captable.securityClasses.find((sc) => sc.id === issuance.securityClassId);

    // Require force flag to delete issuances (they represent actual ownership)
    if (!opts.force) {
      return {
        success: false,
        message: `❌ Deleting an issuance removes ${issuance.qty.toLocaleString()} shares from ${stakeholder?.name || 'stakeholder'}. Use --force to confirm.`,
      };
    }

    captable.issuances.splice(index, 1);

    helpers.logAction(captable, {
      action: 'ISSUANCE_DELETE',
      entity: 'issuance',
      entityId: issuance.id,
      details: `Deleted issuance of ${issuance.qty.toLocaleString()} ${security?.label || 'shares'} to ${stakeholder?.name || 'stakeholder'}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Deleted issuance ${issuance.id}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}
