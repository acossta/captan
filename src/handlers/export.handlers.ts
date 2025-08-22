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
import { getCurrentDate } from '../utils/date-utils.js';
import * as fs from 'fs';
import type { HandlerResult } from './types.js';

/**
 * Escapes a value for safe CSV output
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes quotes by doubling them
 * - Prevents formula injection by prepending single quote
 */
function escapeCSVValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }

  const str = String(value);

  // Prevent formula injection - prepend single quote to formulas
  if (str.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(str[0])) {
    return `"'${str.replace(/"/g, '""')}"`;
  }

  // Check if value needs escaping
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats a row of CSV data with proper escaping
 */
function formatCSVRow(values: (string | number | undefined | null)[]): string {
  return values.map(escapeCSVValue).join(',');
}

export function handleExportCsv(opts: { output?: string; noOptions?: boolean }): HandlerResult {
  try {
    const captable = load('captable.json');

    const rows: string[] = [];

    // Add header row with proper escaping
    rows.push(
      formatCSVRow([
        'Name',
        'Email',
        'Type',
        'Security Class',
        'Quantity',
        'Price Per Share',
        'Date',
        'Vested',
      ])
    );

    // Add share issuances
    captable.issuances?.forEach((iss) => {
      const holder = captable.stakeholders.find((sh) => sh.id === iss.stakeholderId);
      const security = captable.securityClasses.find((sc) => sc.id === iss.securityClassId);

      rows.push(
        formatCSVRow([
          holder?.name,
          holder?.email,
          'Shares',
          security?.label,
          iss.qty,
          iss.pps,
          iss.date,
          iss.qty, // Shares are always "vested"
        ])
      );
    });

    // Add option grants unless excluded
    if (!opts.noOptions) {
      const today = getCurrentDate();
      captable.optionGrants?.forEach((grant) => {
        const holder = captable.stakeholders.find((sh) => sh.id === grant.stakeholderId);
        const pool = captable.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');
        const vested = grant.vesting ? helpers.calculateVestedOptions(grant, today) : grant.qty;

        rows.push(
          formatCSVRow([
            holder?.name,
            holder?.email,
            'Options',
            pool?.label || 'Option Pool',
            grant.qty,
            grant.exercise,
            grant.grantDate,
            vested,
          ])
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleExportJson(opts: { output?: string; pretty?: boolean }): HandlerResult {
  try {
    const captable = load('captable.json');

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error: ${msg}`,
    };
  }
}

export function handleExportPdf(_opts: { output?: string }): HandlerResult {
  return {
    success: false,
    message: '❌ PDF export is not yet implemented. Use CSV or JSON export instead.',
  };
}
