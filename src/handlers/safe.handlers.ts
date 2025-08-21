/**
 * SAFE Resource Handlers
 *
 * Handles all SAFE investment-related commands:
 * - add: Add a new SAFE
 * - list: List all SAFEs
 * - show: Show SAFE details
 * - update: Update SAFE terms
 * - delete: Remove a SAFE
 * - convert: Convert SAFEs to shares
 */

import { resolveStakeholder, formatStakeholderReference } from '../identifier-resolver.js';
import * as helpers from '../services/helpers.js';
import { load, save } from '../store.js';
import type { HandlerResult } from './types.js';

export function handleSafeAdd(opts: {
  stakeholder: string;
  amount: string;
  cap?: string;
  discount?: string;
  type?: string;
  date?: string;
  note?: string;
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

    const amount = parseFloat(opts.amount);
    const valuationCap = opts.cap ? parseFloat(opts.cap) : undefined;
    const discountPct = opts.discount ? parseFloat(opts.discount) : undefined;
    const isPostMoney = opts.type?.toLowerCase() === 'post-money';
    const date = opts.date || new Date().toISOString().slice(0, 10);

    if (!valuationCap && !discountPct) {
      return {
        success: false,
        message: '❌ SAFE must have either a valuation cap or discount (or both)',
      };
    }

    const safe = helpers.createSAFE(
      stakeholderResult.stakeholder.id,
      amount,
      valuationCap,
      discountPct,
      isPostMoney,
      date,
      opts.note
    );

    captable.safes.push(safe);

    const terms: string[] = [];
    if (valuationCap) terms.push(`$${valuationCap.toLocaleString()} cap`);
    if (discountPct) terms.push(`${discountPct}% discount`);
    const typeStr = isPostMoney ? 'post-money' : 'pre-money';

    helpers.logAction(captable, {
      action: 'SAFE_ADD',
      entity: 'safe',
      entityId: safe.id,
      details: `Added $${amount.toLocaleString()} ${typeStr} SAFE for ${stakeholderResult.stakeholder.name} (${terms.join(', ')})`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Added $${amount.toLocaleString()} SAFE for ${formatStakeholderReference(stakeholderResult.stakeholder)} (${terms.join(', ')})`,
      data: safe,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSafeList(opts: { stakeholder?: string; format?: string }): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    let safes = captable.safes;

    // Filter by stakeholder if provided
    if (opts.stakeholder) {
      const stakeholderResult = resolveStakeholder(opts.stakeholder);
      if (!stakeholderResult.success || !stakeholderResult.stakeholder) {
        return {
          success: false,
          message: `❌ ${stakeholderResult.error}`,
        };
      }
      safes = safes.filter((s) => s.stakeholderId === stakeholderResult.stakeholder!.id);
    }

    if (opts.format === 'json') {
      return {
        success: true,
        message: JSON.stringify(safes, null, 2),
        data: safes,
      };
    }

    // Table format
    if (safes.length === 0) {
      return {
        success: true,
        message: 'No SAFEs found.',
      };
    }

    let output = '💰 SAFE Investments\n\n';
    output +=
      'ID              Date        Investor                   Amount        Cap           Discount  Type\n';
    output += '─'.repeat(100) + '\n';

    for (const safe of safes) {
      const stakeholder = captable.stakeholders.find((sh) => sh.id === safe.stakeholderId);

      const id = safe.id.substring(0, 14).padEnd(14);
      const date = safe.date.padEnd(10);
      const investor = (stakeholder?.name || 'Unknown').substring(0, 24).padEnd(24);
      const amount = `$${safe.amount.toLocaleString()}`.padStart(12);
      const cap = safe.cap ? `$${safe.cap.toLocaleString()}`.padStart(12) : '-'.padStart(12);
      const discount = safe.discount
        ? `${(safe.discount * 100).toFixed(0)}%`.padStart(8)
        : '-'.padStart(8);
      const type = safe.type === 'post' ? 'Post' : 'Pre';

      output += `${id}  ${date}  ${investor}  ${amount}  ${cap}  ${discount}  ${type}\n`;
    }

    const totalAmount = safes.reduce((sum, s) => sum + s.amount, 0);
    output += `\nTotal SAFE investment: $${totalAmount.toLocaleString()}`;

    return {
      success: true,
      message: output,
      data: safes,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSafeShow(id: string | undefined, _opts: any): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a SAFE ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const safe = captable.safes.find((s) => s.id === id);
    if (!safe) {
      return {
        success: false,
        message: `❌ SAFE not found: ${id}`,
      };
    }

    const stakeholder = captable.stakeholders.find((sh) => sh.id === safe.stakeholderId);

    let output = `\n💰 SAFE Details\n\n`;
    output += `ID:             ${safe.id}\n`;
    output += `Date:           ${safe.date}\n`;
    output += `Investor:       ${stakeholder?.name || 'Unknown'} (${safe.stakeholderId})\n`;
    output += `Amount:         $${safe.amount.toLocaleString()}\n`;
    output += `Type:           ${safe.type === 'post' ? 'Post-money' : 'Pre-money'}\n`;

    output += `\n📊 Terms:\n`;
    if (safe.cap) {
      output += `  Valuation Cap:  $${safe.cap.toLocaleString()}\n`;
    }
    if (safe.discount) {
      output += `  Discount:       ${(safe.discount * 100).toFixed(1)}%\n`;
    }

    if (safe.note) {
      output += `\n📝 Note: ${safe.note}\n`;
    }

    // Calculate conversion scenarios
    output += `\n🔄 Conversion Scenarios:\n`;
    if (safe.cap) {
      const sharesAtCap = Math.floor(safe.amount / (safe.cap / 10000000)); // Assuming 10M shares
      output += `  At cap:         ~${sharesAtCap.toLocaleString()} shares\n`;
    }
    if (safe.discount) {
      output += `  With discount:  Price reduced by ${(safe.discount * 100).toFixed(0)}%\n`;
    }

    return {
      success: true,
      message: output,
      data: safe,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSafeUpdate(
  id: string | undefined,
  opts: { discount?: string; cap?: string }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a SAFE ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const safe = captable.safes.find((s) => s.id === id);
    if (!safe) {
      return {
        success: false,
        message: `❌ SAFE not found: ${id}`,
      };
    }

    const updates: string[] = [];

    if (opts.cap !== undefined) {
      const newCap = parseFloat(opts.cap);
      safe.cap = newCap;
      updates.push(`valuation cap to $${newCap.toLocaleString()}`);
    }

    if (opts.discount !== undefined) {
      const discountPct = parseFloat(opts.discount);
      const discountDecimal = discountPct / 100; // Convert percentage to decimal
      safe.discount = discountDecimal;
      updates.push(`discount to ${discountPct}%`);
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: '❌ No updates provided. Use --cap or --discount to update.',
      };
    }

    helpers.logAction(captable, {
      action: 'SAFE_UPDATE',
      entity: 'safe',
      entityId: safe.id,
      details: `Updated ${updates.join(' and ')}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Updated SAFE ${safe.id}`,
      data: safe,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSafeDelete(id: string | undefined, opts: { force?: boolean }): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a SAFE ID',
      };
    }

    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const index = captable.safes.findIndex((s) => s.id === id);
    if (index === -1) {
      return {
        success: false,
        message: `❌ SAFE not found: ${id}`,
      };
    }

    const safe = captable.safes[index];
    const stakeholder = captable.stakeholders.find((sh) => sh.id === safe.stakeholderId);

    // Require force flag to delete SAFEs (they represent actual investments)
    if (!opts.force) {
      return {
        success: false,
        message: `❌ This will delete a $${safe.amount.toLocaleString()} investment from ${stakeholder?.name || 'investor'}. Use --force to confirm.`,
      };
    }

    captable.safes.splice(index, 1);

    helpers.logAction(captable, {
      action: 'SAFE_DELETE',
      entity: 'safe',
      entityId: safe.id,
      details: `Deleted $${safe.amount.toLocaleString()} SAFE from ${stakeholder?.name || 'investor'}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Deleted SAFE ${safe.id}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSafeConvert(opts: {
  preMoney: string;
  pps: string;
  newMoney?: string;
  date?: string;
  dryRun?: boolean;
}): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    if (captable.safes.length === 0) {
      return {
        success: true,
        message: 'No SAFEs to convert.',
      };
    }

    const preMoneyValuation = parseFloat(opts.preMoney);
    const pricePerShare = parseFloat(opts.pps);
    const newMoney = opts.newMoney ? parseFloat(opts.newMoney) : 0;
    const date = opts.date || new Date().toISOString().slice(0, 10);

    // Calculate conversions
    const conversions = helpers.calculateSAFEConversions(
      captable,
      pricePerShare,
      preMoneyValuation
    );

    if (opts.dryRun) {
      // Preview mode
      let output = '🔄 SAFE Conversion Preview\n\n';
      output += `Pre-money valuation: $${preMoneyValuation.toLocaleString()}\n`;
      output += `Price per share: $${pricePerShare}\n`;
      if (newMoney > 0) {
        output += `New money raised: $${newMoney.toLocaleString()}\n`;
      }
      output += '\n';

      let totalShares = 0;
      for (const conversion of conversions) {
        const stakeholder = captable.stakeholders.find(
          (sh) => sh.id === conversion.safe.stakeholderId
        );
        output += `${stakeholder?.name || 'Unknown'}:\n`;
        output += `  Investment: $${conversion.safe.amount.toLocaleString()}\n`;
        output += `  Shares: ${conversion.shares.toLocaleString()} at $${conversion.conversionPrice}/share`;

        if (conversion.conversionReason === 'cap') {
          output += ' (cap)';
        } else if (conversion.conversionReason === 'discount') {
          output += ' (discount)';
        } else {
          output += ' (round price)';
        }

        output += '\n\n';
        totalShares += conversion.shares;
      }

      output += `Total new shares: ${totalShares.toLocaleString()}\n`;

      return {
        success: true,
        message: output,
        data: conversions,
      };
    }

    // Execute conversion
    const commonStock = captable.securityClasses.find((sc) => sc.kind === 'COMMON');
    if (!commonStock) {
      return {
        success: false,
        message: '❌ No common stock security class found',
      };
    }

    for (const conversion of conversions) {
      const issuance = helpers.createIssuance(
        conversion.safe.stakeholderId,
        commonStock.id,
        conversion.shares,
        conversion.conversionPrice,
        date
      );

      captable.issuances.push(issuance);
    }

    // Remove converted SAFEs
    captable.safes = [];

    helpers.logAction(captable, {
      action: 'SAFE_CONVERT',
      entity: 'safe',
      entityId: 'all',
      details: `Converted ${conversions.length} SAFEs at $${pricePerShare}/share (pre-money: $${preMoneyValuation.toLocaleString()})`,
    });

    save(captable, 'captable.json');

    const totalShares = conversions.reduce((sum, c) => sum + c.shares, 0);
    return {
      success: true,
      message: `✅ Converted ${conversions.length} SAFEs into ${totalShares.toLocaleString()} shares`,
      data: conversions,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}
