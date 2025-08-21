/**
 * Export Resource Handlers
 *
 * Handles all data export commands:
 * - csv: Export to CSV format
 * - json: Export to JSON format
 * - pdf: Export to PDF format (not implemented)
 */

import * as helpers from '../services/helpers.js';
import { load } from '../store.js';
import * as fs from 'fs';
import type { HandlerResult } from './types.js';

export function handleExportCsv(opts: { output?: string; noOptions?: boolean }): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    const rows: string[] = [];
    rows.push('Name,Email,Type,Security Class,Quantity,Price Per Share,Date,Vested');

    // Add share issuances
    captable.issuances?.forEach((iss) => {
      const holder = captable.stakeholders.find((sh) => sh.id === iss.stakeholderId);
      const security = captable.securityClasses.find((sc) => sc.id === iss.securityClassId);

      rows.push(
        [
          holder?.name || '',
          holder?.email || '',
          'Shares',
          security?.label || '',
          iss.qty.toString(),
          iss.pps?.toString() || '', // Fixed: pricePerShare -> pps
          iss.date,
          iss.qty.toString(), // Shares are always "vested"
        ].join(',')
      );
    });

    // Add option grants unless excluded
    if (!opts.noOptions) {
      const today = new Date().toISOString().slice(0, 10);
      captable.optionGrants?.forEach((grant) => {
        const holder = captable.stakeholders.find((sh) => sh.id === grant.stakeholderId);
        const pool = captable.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
        const vested = grant.vesting ? helpers.calculateVestedOptions(grant, today) : grant.qty;

        rows.push(
          [
            holder?.name || '',
            holder?.email || '',
            'Options',
            pool?.label || 'Option Pool',
            grant.qty.toString(),
            grant.exercise.toString(),
            grant.grantDate,
            vested.toString(),
          ].join(',')
        );
      });
    }

    const csv = rows.join('\n');

    if (opts.output) {
      fs.writeFileSync(opts.output, csv);
      return {
        success: true,
        message: `✅ Exported cap table to ${opts.output}`,
      };
    } else {
      return {
        success: true,
        message: csv,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleExportJson(opts: { output?: string; pretty?: boolean }): HandlerResult {
  try {
    const captable = load('captable.json');
    if (!captable) {
      return {
        success: false,
        message: '❌ No captable.json found. Run "captan init" first.',
      };
    }

    const json = opts.pretty ? JSON.stringify(captable, null, 2) : JSON.stringify(captable);

    if (opts.output) {
      fs.writeFileSync(opts.output, json);
      return {
        success: true,
        message: `✅ Exported cap table to ${opts.output}`,
      };
    } else {
      return {
        success: true,
        message: json,
        data: captable,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

export function handleExportPdf(_opts: { output?: string }): HandlerResult {
  return {
    success: false,
    message: '❌ PDF export is not yet implemented. Use CSV or JSON export instead.',
  };
}
