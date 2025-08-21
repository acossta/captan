/**
 * Stakeholder Resource Handlers
 *
 * Handles all stakeholder-related commands:
 * - add: Create a new stakeholder
 * - list: List all stakeholders
 * - show: Show stakeholder details
 * - update: Update stakeholder information
 * - delete: Remove a stakeholder
 */

import {
  resolveStakeholder,
  formatStakeholderReference,
  suggestSimilarStakeholders,
} from '../identifier-resolver.js';
import * as helpers from '../services/helpers.js';
import { load, save } from '../store.js';
import type { HandlerResult } from './types.js';

export function handleStakeholderAdd(opts: {
  name: string;
  email?: string;
  entity?: string;
}): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    // Check for duplicate email
    if (opts.email) {
      const existing = captable.stakeholders.find((sh) => sh.email === opts.email);
      if (existing) {
        return {
          success: false,
          message: `❌ Stakeholder with email ${opts.email} already exists (${existing.id})`,
        };
      }
    }

    const entityType = opts.entity?.toUpperCase() === 'ENTITY' ? 'ENTITY' : 'PERSON';
    const stakeholder = helpers.createStakeholder(opts.name, opts.email || '', entityType);

    captable.stakeholders.push(stakeholder);

    helpers.logAction(captable, {
      action: 'STAKEHOLDER_ADD',
      entity: 'stakeholder',
      entityId: stakeholder.id,
      details: `Added ${entityType.toLowerCase()} stakeholder: ${opts.name}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Added stakeholder ${formatStakeholderReference(stakeholder)}`,
      data: stakeholder,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleStakeholderList(opts: { format?: string }): HandlerResult {
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
        message: JSON.stringify(captable.stakeholders, null, 2),
        data: captable.stakeholders,
      };
    }

    // Table format
    if (captable.stakeholders.length === 0) {
      return {
        success: true,
        message: 'No stakeholders found.',
      };
    }

    let output = '📋 Stakeholders\n\n';
    output += 'ID                  Name                          Email                    Type\n';
    output += '─'.repeat(85) + '\n';

    for (const sh of captable.stakeholders) {
      const id = sh.id.padEnd(18);
      const name = sh.name.substring(0, 28).padEnd(28);
      const email = (sh.email || '-').substring(0, 22).padEnd(22);
      const type = sh.type === 'entity' ? 'ENTITY' : 'PERSON';
      output += `${id}  ${name}  ${email}  ${type}\n`;
    }

    return {
      success: true,
      message: output,
      data: captable.stakeholders,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleStakeholderShow(idOrEmail: string | undefined, _opts: any): HandlerResult {
  try {
    if (!idOrEmail) {
      return {
        success: false,
        message: '❌ Please provide a stakeholder ID or email',
      };
    }

    const result = resolveStakeholder(idOrEmail);
    if (!result.success || !result.stakeholder) {
      // Suggest similar stakeholders
      const suggestions = suggestSimilarStakeholders(idOrEmail, 3);
      let message = `❌ ${result.error}`;

      if (suggestions.length > 0) {
        message += '\n\nDid you mean one of these?\n';
        suggestions.forEach((sh) => {
          message += `  • ${formatStakeholderReference(sh)}\n`;
        });
      }

      return { success: false, message };
    }

    const stakeholder = result.stakeholder;
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    // Get holdings
    const holdings = helpers.getStakeholderHoldings(captable, stakeholder.id);

    let output = `\n👤 Stakeholder Details\n\n`;
    output += `Name:   ${stakeholder.name}\n`;
    output += `ID:     ${stakeholder.id}\n`;
    output += `Email:  ${stakeholder.email || '-'}\n`;
    output += `Type:   ${stakeholder.type === 'entity' ? 'ENTITY' : 'PERSON'}\n`;
    output += `\n`;

    if (holdings.issuances.length > 0) {
      output += `📊 Share Issuances:\n`;
      holdings.issuances.forEach((iss) => {
        const security = captable.securityClasses.find((sc) => sc.id === iss.securityClassId);
        output += `  • ${iss.qty.toLocaleString()} shares of ${security?.label || 'Unknown'}\n`;
      });
      output += `\n`;
    }

    if (holdings.grants.length > 0) {
      output += `🎯 Option Grants:\n`;
      holdings.grants.forEach((grant) => {
        const vested = grant.vesting
          ? helpers.calculateVestedOptions(grant, new Date().toISOString().slice(0, 10))
          : grant.qty;
        output += `  • ${grant.qty.toLocaleString()} options (${vested.toLocaleString()} vested) at $${grant.exercise}\n`;
      });
      output += `\n`;
    }

    if (holdings.safes.length > 0) {
      output += `💰 SAFEs:\n`;
      holdings.safes.forEach((safe) => {
        const terms: string[] = [];
        if (safe.cap) terms.push(`$${safe.cap.toLocaleString()} cap`);
        if (safe.discount) terms.push(`${(safe.discount * 100).toFixed(0)}% discount`);
        output += `  • $${safe.amount.toLocaleString()} investment`;
        if (terms.length > 0) output += ` (${terms.join(', ')})`;
        output += `\n`;
      });
    }

    return {
      success: true,
      message: output,
      data: { stakeholder, holdings },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleStakeholderUpdate(
  idOrEmail: string | undefined,
  opts: { name?: string; email?: string }
): HandlerResult {
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
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const stakeholder = captable.stakeholders.find((sh) => sh.id === result.stakeholder!.id);
    if (!stakeholder) {
      return {
        success: false,
        message: '❌ Stakeholder not found in captable',
      };
    }

    const updates: string[] = [];

    if (opts.name) {
      stakeholder.name = opts.name;
      updates.push(`name to "${opts.name}"`);
    }

    if (opts.email !== undefined) {
      // Check for duplicate email
      if (opts.email) {
        const existing = captable.stakeholders.find(
          (sh) => sh.email === opts.email && sh.id !== stakeholder.id
        );
        if (existing) {
          return {
            success: false,
            message: `❌ Email ${opts.email} is already used by ${existing.name} (${existing.id})`,
          };
        }
      }
      stakeholder.email = opts.email;
      updates.push(opts.email ? `email to "${opts.email}"` : 'removed email');
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: '❌ No updates provided. Use --name or --email to update.',
      };
    }

    helpers.logAction(captable, {
      action: 'STAKEHOLDER_UPDATE',
      entity: 'stakeholder',
      entityId: stakeholder.id,
      details: `Updated ${updates.join(' and ')}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Updated stakeholder ${formatStakeholderReference(stakeholder)}`,
      data: stakeholder,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleStakeholderDelete(
  idOrEmail: string | undefined,
  opts: { force?: boolean }
): HandlerResult {
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
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    const stakeholderId = result.stakeholder.id;

    // Check for existing holdings
    const hasIssuances = captable.issuances.some((i) => i.stakeholderId === stakeholderId);
    const hasGrants = captable.optionGrants.some((g) => g.stakeholderId === stakeholderId);
    const hasSafes = captable.safes.some((s) => s.stakeholderId === stakeholderId);

    if ((hasIssuances || hasGrants || hasSafes) && !opts.force) {
      return {
        success: false,
        message: `❌ Stakeholder has existing holdings. Use --force to delete anyway.`,
      };
    }

    // Remove stakeholder
    const index = captable.stakeholders.findIndex((sh) => sh.id === stakeholderId);
    if (index === -1) {
      return {
        success: false,
        message: '❌ Stakeholder not found in captable',
      };
    }

    const stakeholder = captable.stakeholders[index];
    captable.stakeholders.splice(index, 1);

    // If forced, also remove all related holdings
    if (opts.force) {
      captable.issuances = captable.issuances.filter((i) => i.stakeholderId !== stakeholderId);
      captable.optionGrants = captable.optionGrants.filter(
        (g) => g.stakeholderId !== stakeholderId
      );
      captable.safes = captable.safes.filter((s) => s.stakeholderId !== stakeholderId);
    }

    helpers.logAction(captable, {
      action: 'STAKEHOLDER_DELETE',
      entity: 'stakeholder',
      entityId: stakeholderId,
      details: `Deleted stakeholder: ${stakeholder.name}${opts.force ? ' (forced, removed all holdings)' : ''}`,
    });

    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Deleted stakeholder ${formatStakeholderReference(stakeholder)}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}
