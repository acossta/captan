/**
 * System Resource Handlers
 *
 * Handles all system-level commands:
 * - init: Initialize a new cap table
 * - validate: Validate cap table data
 * - schema: Generate JSON schema file
 * - log: View audit log
 */

import { runInitWizard, buildModelFromWizard } from '../init-wizard.js';
import * as helpers from '../services/helpers.js';
import { load, save, exists } from '../store.js';
import { validateCaptable, validateCaptableExtended, type ValidationWarning } from '../schema.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FileModelSchema, type FileModel } from '../model.js';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import type { HandlerResult } from './types.js';

export async function handleInit(opts: {
  wizard?: boolean;
  name?: string;
  type?: string;
  state?: string;
  currency?: string;
  authorized?: string;
  par?: string;
  poolPct?: string;
  founder?: string[];
  date?: string;
}): Promise<HandlerResult> {
  try {
    // Check if captable already exists
    if (exists('captable.json')) {
      return {
        success: false,
        message: '❌ A captable.json file already exists. Delete it first to re-initialize.',
      };
    }

    // Run wizard if requested
    if (opts.wizard) {
      try {
        const wizardResult = await runInitWizard();
        const captable = buildModelFromWizard(wizardResult);
        save(captable, 'captable.json');
        return {
          success: true,
          message: `✅ Cap table initialized for ${wizardResult.name}`,
          data: captable,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `❌ Wizard cancelled or failed: ${error.message}`,
        };
      }
    }

    // Manual initialization
    if (!opts.name) {
      return {
        success: false,
        message: '❌ Company name is required. Use --name or --wizard',
      };
    }

    const entityType = opts.type?.toUpperCase().replace('-', '_') || 'C_CORP';
    if (!['C_CORP', 'S_CORP', 'LLC'].includes(entityType)) {
      return {
        success: false,
        message: '❌ Invalid entity type. Must be c-corp, s-corp, or llc',
      };
    }

    const authorized = parseInt(opts.authorized || '10000000');
    const parValue = parseFloat(opts.par || '0.00001');
    const poolPct = parseFloat(opts.poolPct || '10');
    const date = opts.date || new Date().toISOString().slice(0, 10);

    // Create cap table structure
    const captable: FileModel = {
      version: 2,
      company: {
        id: `comp_${randomUUID()}`,
        name: opts.name,
        formationDate: date,
        entityType: entityType as any,
        jurisdiction: opts.state || 'DE',
        currency: opts.currency || 'USD',
      },
      stakeholders: [],
      securityClasses: [],
      issuances: [],
      optionGrants: [],
      safes: [],
      valuations: [],
      audit: [],
    };

    // Create common stock
    const commonStock = helpers.createSecurityClass('COMMON', 'Common Stock', authorized, parValue);
    captable.securityClasses.push(commonStock);

    // Create option pool if percentage specified
    if (poolPct > 0) {
      const poolSize = Math.floor(authorized * (poolPct / 100));
      const optionPool = helpers.createSecurityClass('OPTION_POOL', 'Stock Option Pool', poolSize);
      captable.securityClasses.push(optionPool);
    }

    // Add founders if specified
    if (opts.founder && opts.founder.length > 0) {
      for (const founderStr of opts.founder) {
        const parts = founderStr.split(':');
        if (parts.length < 2) {
          return {
            success: false,
            message: `❌ Invalid founder format. Use "Name:email:shares"`,
          };
        }

        const [name, email, sharesStr] = parts;
        const shares = parseInt(sharesStr || '0');

        // Create stakeholder
        const stakeholder = helpers.createStakeholder(name, email, 'PERSON');
        captable.stakeholders.push(stakeholder);

        // Issue shares if specified
        if (shares > 0) {
          const issuance = helpers.createIssuance(
            stakeholder.id,
            commonStock.id,
            shares,
            parValue,
            date
          );
          captable.issuances.push(issuance);
        }
      }
    }

    // Log initialization
    helpers.logAction(captable, {
      action: 'INIT',
      entity: 'system',
      entityId: 'captable',
      details: `Initialized cap table for ${opts.name}`,
    });

    // Save cap table
    save(captable, 'captable.json');

    return {
      success: true,
      message: `✅ Initialized cap table for ${opts.name}`,
      data: captable,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleValidate(opts: { extended?: boolean; file?: string }): HandlerResult {
  try {
    const filename = opts.file || 'captable.json';
    const captable = load(filename);

    if (!captable) {
      return {
        success: false,
        message: `❌ No ${filename} found.`,
      };
    }

    // Basic schema validation
    const schemaResult = validateCaptable(captable);
    if (!schemaResult.valid) {
      let message = `❌ Schema validation failed:\n`;
      message += (schemaResult.errors || []).map((e: string) => `  • ${e}`).join('\n');
      return {
        success: false,
        message,
      };
    }

    // Extended business rules validation
    if (opts.extended) {
      const extendedResult = validateCaptableExtended(captable);
      if (!extendedResult.valid) {
        let message = `⚠️ Business rule violations:\n`;
        message += (extendedResult.warnings || [])
          .map((w: ValidationWarning) => `  • ${w.message}`)
          .join('\n');
        return {
          success: false,
          message,
        };
      }
    }

    // Calculate statistics
    const stats = {
      stakeholders: captable.stakeholders.length,
      securities: captable.securityClasses.length,
      issuances: captable.issuances?.length || 0,
      grants: captable.optionGrants?.length || 0,
      safes: captable.safes?.length || 0,
    };

    return {
      success: true,
      message: `✅ Validation passed. ${stats.stakeholders} stakeholders, ${stats.securities} securities, ${stats.issuances} issuances`,
      data: stats,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleSchema(opts: { output?: string }): HandlerResult {
  try {
    const schema = zodToJsonSchema(FileModelSchema);
    const json = JSON.stringify(schema, null, 2);

    if (opts.output) {
      fs.writeFileSync(opts.output, json);
      return {
        success: true,
        message: `✅ Schema written to ${opts.output}`,
      };
    } else {
      return {
        success: true,
        message: json,
        data: schema,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleLog(opts: { action?: string; limit?: string }): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found.',
      };
    }

    let logs = captable.audit || [];

    // Filter by action if specified
    if (opts.action) {
      logs = logs.filter((log: any) => log.action === opts.action!.toUpperCase());
    }

    // Limit results
    const limit = parseInt(opts.limit || '20');
    logs = logs.slice(-limit);

    if (logs.length === 0) {
      return {
        success: true,
        message: 'No audit log entries found.',
      };
    }

    let output = `\n📝 Audit Log (last ${logs.length} entries)\n\n`;

    logs.reverse().forEach((log: any) => {
      const timestamp = new Date(log.ts).toLocaleString();
      output += `[${timestamp}] ${log.action} - ${log.data?.details || ''}\n`;
    });

    return {
      success: true,
      message: output,
      data: logs,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}
