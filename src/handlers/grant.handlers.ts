/**
 * Option Grant Resource Handlers
 *
 * Handles all option grant-related commands:
 * - add: Grant new options
 * - list: List all grants
 * - show: Show grant details
 * - update: Update grant information
 * - delete: Remove a grant
 */

import { resolveStakeholder, formatStakeholderReference } from '../identifier-resolver.js';
import * as helpers from '../services/helpers.js';
import { load, save } from '../store.js';
import { getCurrentDate } from '../utils/date-utils.js';
import type { HandlerResult } from './types.js';

export function handleGrantAdd(opts: {
  stakeholder: string;
  qty: string;
  exercise: string;
  pool?: string;
  date?: string;
  vestingMonths?: string;
  cliffMonths?: string;
  vestingStart?: string;
  noVesting?: boolean;
}): HandlerResult {
  try {
    const captable = load('captable.json');

    // Resolve stakeholder
    const stakeholderResult = resolveStakeholder(opts.stakeholder);
    if (!stakeholderResult.success || !stakeholderResult.stakeholder) {
      return {
        success: false,
        message: `❌ ${stakeholderResult.error}`,
      };
    }

    // Find option pool
    let pool;
    if (opts.pool) {
      pool = captable.securityClasses.find(
        (sc) => sc.id === opts.pool && sc.kind === 'OPTION_POOL'
      );
      if (!pool) {
        return {
          success: false,
          message: `❌ Option pool not found: ${opts.pool}`,
        };
      }
    } else {
      // Default to first pool
      pool = captable.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
      if (!pool) {
        return {
          success: false,
          message:
            '❌ No option pool found. Create one with "captan security add --kind OPTION_POOL"',
        };
      }
    }

    const qty = parseInt(opts.qty, 10);
    const exercisePrice = parseFloat(opts.exercise);
    const date = opts.date || getCurrentDate();

    // Validate inputs
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        success: false,
        message: '❌ Invalid quantity. Please provide a positive integer.',
      };
    }

    if (!Number.isFinite(exercisePrice) || exercisePrice < 0) {
      return {
        success: false,
        message: '❌ Invalid exercise price. Please provide a non-negative number.',
      };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        success: false,
        message: '❌ Invalid date format. Please use YYYY-MM-DD.',
      };
    }

    // Validate vesting parameters if provided
    if (!opts.noVesting) {
      if (opts.vestingMonths) {
        const vestingMonths = parseInt(opts.vestingMonths, 10);
        if (!Number.isFinite(vestingMonths) || vestingMonths <= 0) {
          return {
            success: false,
            message: '❌ Invalid vesting months. Please provide a positive integer.',
          };
        }
      }

      if (opts.cliffMonths) {
        const cliffMonths = parseInt(opts.cliffMonths, 10);
        if (!Number.isFinite(cliffMonths) || cliffMonths < 0) {
          return {
            success: false,
            message: '❌ Invalid cliff months. Please provide a non-negative integer.',
          };
        }
      }

      if (opts.vestingStart && !/^\d{4}-\d{2}-\d{2}$/.test(opts.vestingStart)) {
        return {
          success: false,
          message: '❌ Invalid vesting start date format. Please use YYYY-MM-DD.',
        };
      }
    }

    // Check pool availability
    // LIMITATION: Since optionPoolId is not stored in the OptionGrant model,
    // we must count ALL grants against ALL pools. This means with multiple pools,
    // the available count is conservative (may show less than actually available).
    // TODO: Future enhancement - add poolId to OptionGrant model for accurate tracking
    const poolUsed = captable.optionGrants.reduce((sum, g) => sum + g.qty, 0);
    const poolAvailable = pool.authorized - poolUsed;

    if (qty > poolAvailable) {
      return {
        success: false,
        message: `❌ Insufficient options in pool. Available: ${poolAvailable.toLocaleString('en-US')}`,
      };
    }

    const grant = helpers.createOptionGrant(
      stakeholderResult.stakeholder.id,
      pool.id,
      qty,
      exercisePrice,
      date,
      opts.noVesting
        ? undefined
        : {
            start: opts.vestingStart || date,
            monthsTotal: parseInt(opts.vestingMonths || '48', 10),
            cliffMonths: parseInt(opts.cliffMonths || '12', 10),
          }
    );

    captable.optionGrants.push(grant);

    helpers.logAction(captable, {
      action: 'GRANT_ADD',
      entity: 'grant',
      entityId: grant.id,
      details: `Granted ${qty.toLocaleString('en-US')} options to ${stakeholderResult.stakeholder.name} at $${exercisePrice}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Granted ${qty.toLocaleString('en-US')} options to ${formatStakeholderReference(stakeholderResult.stakeholder)} at $${exercisePrice}/share`,
      data: grant,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleGrantList(opts: { stakeholder?: string; format?: string }): HandlerResult {
  try {
    const captable = load('captable.json');

    let grants = captable.optionGrants;

    // Filter by stakeholder if provided
    if (opts.stakeholder) {
      const stakeholderResult = resolveStakeholder(opts.stakeholder);
      if (!stakeholderResult.success || !stakeholderResult.stakeholder) {
        return {
          success: false,
          message: `❌ ${stakeholderResult.error}`,
        };
      }
      grants = grants.filter((g) => g.stakeholderId === stakeholderResult.stakeholder!.id);
    }

    if (opts.format === 'json') {
      return {
        success: true,
        message: JSON.stringify(grants, null, 2),
        data: grants,
      };
    }

    // Table format
    if (grants.length === 0) {
      return {
        success: true,
        message: 'No option grants found.',
      };
    }

    const today = getCurrentDate();

    let output = '🎯 Option Grants\n\n';
    output +=
      'ID              Date        Stakeholder                Quantity      Exercise   Vested\n';
    output += '─'.repeat(90) + '\n';

    for (const grant of grants) {
      const stakeholder = captable.stakeholders.find((sh) => sh.id === grant.stakeholderId);
      const vested = grant.vesting ? helpers.calculateVestedOptions(grant, today) : grant.qty;

      const id = grant.id.substring(0, 14).padEnd(14);
      const date = grant.grantDate.padEnd(10);
      const holder = (stakeholder?.name || 'Unknown').substring(0, 24).padEnd(24);
      const qty = grant.qty.toLocaleString('en-US').padStart(12);
      const exercise = `$${grant.exercise}`.padStart(10);
      const vest = vested.toLocaleString('en-US').padStart(10);

      output += `${id}  ${date}  ${holder}  ${qty}  ${exercise}  ${vest}\n`;
    }

    return {
      success: true,
      message: output,
      data: grants,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleGrantShow(id: string | undefined, _opts: any): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a grant ID',
      };
    }

    const captable = load('captable.json');

    const grant = captable.optionGrants.find((g) => g.id === id);
    if (!grant) {
      return {
        success: false,
        message: `❌ Grant not found: ${id}`,
      };
    }

    const stakeholder = captable.stakeholders.find((sh) => sh.id === grant.stakeholderId);
    const today = getCurrentDate();

    let output = `\n🎯 Option Grant Details\n\n`;
    output += `ID:              ${grant.id}\n`;
    output += `Grant Date:      ${grant.grantDate}\n`;
    output += `Stakeholder:     ${stakeholder?.name || 'Unknown'} (${grant.stakeholderId})\n`;
    output += `Quantity:        ${grant.qty.toLocaleString('en-US')} options\n`;
    output += `Exercise Price:  $${grant.exercise}\n`;

    if (grant.vesting) {
      output += `\n📅 Vesting Schedule:\n`;
      output += `  Start Date:    ${grant.vesting.start}\n`;
      output += `  Total Period:  ${grant.vesting.monthsTotal} months\n`;
      output += `  Cliff:         ${grant.vesting.cliffMonths} months\n`;

      const vested = helpers.calculateVestedOptions(grant, today);
      const vestedPct = grant.qty > 0 ? ((vested / grant.qty) * 100).toFixed(1) : '0.0';
      output += `  Vested:        ${vested.toLocaleString('en-US')} options (${vestedPct}%)\n`;
      output += `  Unvested:      ${(grant.qty - vested).toLocaleString('en-US')} options\n`;

      // Calculate vesting milestones
      const vestingEnd = new Date(grant.vesting.start);
      vestingEnd.setMonth(vestingEnd.getMonth() + grant.vesting.monthsTotal);
      output += `  Fully Vested:  ${vestingEnd.toISOString().slice(0, 10)}\n`;
    } else {
      output += `Vesting:         Fully vested (no vesting schedule)\n`;
    }

    return {
      success: true,
      message: output,
      data: grant,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleGrantUpdate(
  id: string | undefined,
  opts: { vestingStart?: string; exercise?: string }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a grant ID',
      };
    }

    const captable = load('captable.json');

    const grant = captable.optionGrants.find((g) => g.id === id);
    if (!grant) {
      return {
        success: false,
        message: `❌ Grant not found: ${id}`,
      };
    }

    const updates: string[] = [];

    if (opts.vestingStart && grant.vesting) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.vestingStart)) {
        return {
          success: false,
          message: '❌ Invalid date format. Please use YYYY-MM-DD.',
        };
      }
      grant.vesting.start = opts.vestingStart;
      updates.push(`vesting start date to ${opts.vestingStart}`);
    }

    if (opts.exercise !== undefined) {
      const newExercise = parseFloat(opts.exercise);
      // Validate exercise price
      if (!Number.isFinite(newExercise) || newExercise < 0) {
        return {
          success: false,
          message: '❌ Invalid exercise price. Please provide a non-negative number.',
        };
      }
      grant.exercise = newExercise;
      updates.push(`exercise price to $${newExercise}`);
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: '❌ No updates provided. Use --vesting-start or --exercise to update.',
      };
    }

    helpers.logAction(captable, {
      action: 'GRANT_UPDATE',
      entity: 'grant',
      entityId: grant.id,
      details: `Updated ${updates.join(' and ')}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Updated grant ${grant.id}`,
      data: grant,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleGrantDelete(
  id: string | undefined,
  opts: { force?: boolean }
): HandlerResult {
  try {
    if (!id) {
      return {
        success: false,
        message: '❌ Please provide a grant ID',
      };
    }

    const captable = load('captable.json');

    const index = captable.optionGrants.findIndex((g) => g.id === id);
    if (index === -1) {
      return {
        success: false,
        message: `❌ Grant not found: ${id}`,
      };
    }

    const grant = captable.optionGrants[index];
    const stakeholder = captable.stakeholders.find((sh) => sh.id === grant.stakeholderId);
    const today = getCurrentDate();

    // Check if grant is partially vested
    if (grant.vesting && !opts.force) {
      const vested = helpers.calculateVestedOptions(grant, today);
      if (vested > 0) {
        return {
          success: false,
          message: `❌ Grant has ${vested.toLocaleString('en-US')} vested options. Use --force to delete anyway.`,
        };
      }
    }

    captable.optionGrants.splice(index, 1);

    helpers.logAction(captable, {
      action: 'GRANT_DELETE',
      entity: 'grant',
      entityId: grant.id,
      details: `Deleted grant of ${grant.qty.toLocaleString('en-US')} options to ${stakeholder?.name || 'stakeholder'}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Deleted grant ${grant.id}`,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}
