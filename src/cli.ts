#!/usr/bin/env node
import { Command } from 'commander';
import { LOGO, NAME, TAGLINE } from './branding.js';
import * as handlers from './handlers/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const program = new Command();

program
  .name('captan')
  .description(`${NAME} — ${TAGLINE}`)
  .version(packageJson.version)
  .showHelpAfterError('(use --help for usage)')
  .addHelpText('before', LOGO + '\n');

// ============================================
// STAKEHOLDER RESOURCE COMMANDS
// ============================================
const stakeholder = program.command('stakeholder').description('Manage stakeholders');

stakeholder
  .command('add')
  .description('Add a new stakeholder')
  .requiredOption('--name <name>', 'stakeholder name')
  .option('--email <email>', 'email address')
  .option('--entity <type>', 'entity type (PERSON or ENTITY)', 'PERSON')
  .action((opts) => {
    const result = handlers.handleStakeholderAdd(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

stakeholder
  .command('list')
  .description('List all stakeholders')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleStakeholderList(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

stakeholder
  .command('show [id-or-email]')
  .description('Show stakeholder details')
  .action((idOrEmail, opts) => {
    const result = handlers.handleStakeholderShow(idOrEmail, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

stakeholder
  .command('update [id-or-email]')
  .description('Update stakeholder information')
  .option('--name <name>', 'new name')
  .option('--email <email>', 'new email')
  .action((idOrEmail, opts) => {
    const result = handlers.handleStakeholderUpdate(idOrEmail, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

stakeholder
  .command('delete [id-or-email]')
  .description('Delete a stakeholder')
  .option('--force', 'force deletion even if stakeholder has holdings')
  .action((idOrEmail, opts) => {
    const result = handlers.handleStakeholderDelete(idOrEmail, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// SECURITY CLASS RESOURCE COMMANDS
// ============================================
const security = program.command('security').description('Manage security classes');

security
  .command('add')
  .description('Add a new security class')
  .requiredOption('--kind <kind>', 'security type (COMMON, PREFERRED, or OPTION_POOL)')
  .requiredOption('--label <label>', 'display label')
  .option('--authorized <amount>', 'authorized shares/units', '10000000')
  .option('--par <value>', 'par value per share')
  .action((opts) => {
    const result = handlers.handleSecurityAdd(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

security
  .command('list')
  .description('List all security classes')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleSecurityList(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

security
  .command('show [id]')
  .description('Show security class details')
  .action((id, opts) => {
    const result = handlers.handleSecurityShow(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

security
  .command('update [id]')
  .description('Update security class')
  .option('--authorized <amount>', 'new authorized amount')
  .option('--label <label>', 'new label')
  .action((id, opts) => {
    const result = handlers.handleSecurityUpdate(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

security
  .command('delete [id]')
  .description('Delete a security class')
  .option('--force', 'force deletion even if shares have been issued')
  .action((id, opts) => {
    const result = handlers.handleSecurityDelete(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// ISSUANCE RESOURCE COMMANDS
// ============================================
const issuance = program.command('issuance').description('Manage share issuances');

issuance
  .command('add')
  .description('Issue new shares')
  .requiredOption('--stakeholder [id-or-email]', 'stakeholder ID or email')
  .requiredOption('--security [id]', 'security class ID')
  .requiredOption('--qty <amount>', 'number of shares')
  .option('--pps <price>', 'price per share')
  .option('--date <date>', 'issuance date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .action((opts) => {
    const result = handlers.handleIssuanceAdd(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

issuance
  .command('list')
  .description('List all issuances')
  .option('--stakeholder [id-or-email]', 'filter by stakeholder')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleIssuanceList(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

issuance
  .command('show [id]')
  .description('Show issuance details')
  .action((id, opts) => {
    const result = handlers.handleIssuanceShow(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

issuance
  .command('update [id]')
  .description('Update an issuance')
  .option('--qty <amount>', 'new share quantity')
  .option('--pps <price>', 'new price per share')
  .action((id, opts) => {
    const result = handlers.handleIssuanceUpdate(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

issuance
  .command('delete [id]')
  .description('Delete an issuance')
  .option('--force', 'force deletion')
  .action((id, opts) => {
    const result = handlers.handleIssuanceDelete(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// GRANT RESOURCE COMMANDS
// ============================================
const grant = program.command('grant').description('Manage option grants');

grant
  .command('add')
  .description('Grant new options')
  .requiredOption('--stakeholder [id-or-email]', 'stakeholder ID or email')
  .requiredOption('--qty <amount>', 'number of options')
  .requiredOption('--exercise <price>', 'exercise price per share')
  .option('--pool [id]', 'option pool ID (defaults to first pool)')
  .option('--date <date>', 'grant date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .option('--vesting-months <months>', 'total vesting period in months', '48')
  .option('--cliff-months <months>', 'cliff period in months', '12')
  .option('--vesting-start <date>', 'vesting start date (defaults to grant date)')
  .option('--no-vesting', 'grant without vesting schedule')
  .action((opts) => {
    const result = handlers.handleGrantAdd(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

grant
  .command('list')
  .description('List all option grants')
  .option('--stakeholder [id-or-email]', 'filter by stakeholder')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleGrantList(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

grant
  .command('show [id]')
  .description('Show grant details')
  .action((id, opts) => {
    const result = handlers.handleGrantShow(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

grant
  .command('update [id]')
  .description('Update a grant')
  .option('--vesting-start <date>', 'new vesting start date')
  .option('--exercise <price>', 'new exercise price')
  .action((id, opts) => {
    const result = handlers.handleGrantUpdate(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

grant
  .command('delete [id]')
  .description('Delete a grant')
  .option('--force', 'force deletion even if partially vested')
  .action((id, opts) => {
    const result = handlers.handleGrantDelete(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// SAFE RESOURCE COMMANDS
// ============================================
const safe = program.command('safe').description('Manage SAFE investments');

safe
  .command('add')
  .description('Add a new SAFE')
  .requiredOption('--stakeholder [id-or-email]', 'stakeholder ID or email')
  .requiredOption('--amount <amount>', 'investment amount')
  .option('--cap <amount>', 'valuation cap')
  .option('--discount <pct>', 'discount percentage (e.g., 20 for 20%)')
  .option('--type <type>', 'SAFE type (pre-money or post-money)', 'post-money')
  .option('--date <date>', 'investment date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .option('--note <note>', 'optional note')
  .action((opts) => {
    const result = handlers.handleSafeAdd(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

safe
  .command('list')
  .description('List all SAFEs')
  .option('--stakeholder [id-or-email]', 'filter by stakeholder')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleSafeList(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

safe
  .command('show [id]')
  .description('Show SAFE details')
  .action((id, opts) => {
    const result = handlers.handleSafeShow(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

safe
  .command('update [id]')
  .description('Update a SAFE')
  .option('--discount <pct>', 'new discount percentage')
  .option('--cap <amount>', 'new valuation cap')
  .action((id, opts) => {
    const result = handlers.handleSafeUpdate(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

safe
  .command('delete [id]')
  .description('Delete a SAFE')
  .option('--force', 'force deletion')
  .action((id, opts) => {
    const result = handlers.handleSafeDelete(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

safe
  .command('convert')
  .description('Convert all SAFEs to shares')
  .requiredOption('--pre-money <amount>', 'pre-money valuation')
  .requiredOption('--pps <price>', 'price per share')
  .option('--new-money <amount>', 'new money raised in round')
  .option('--date <date>', 'conversion date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .option('--dry-run', 'preview conversion without executing')
  .action((opts) => {
    const result = handlers.handleSafeConvert(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// REPORT COMMANDS
// ============================================
const report = program.command('report').description('Generate reports');

report
  .command('summary')
  .description('Generate a comprehensive summary report')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleReportSummary(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

report
  .command('ownership')
  .description('Show ownership breakdown')
  .option('--date <date>', 'as-of date (YYYY-MM-DD)')
  .option('--format <format>', 'output format (table or json)', 'table')
  .action((opts) => {
    const result = handlers.handleReportOwnership(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

report
  .command('stakeholder [id-or-email]')
  .description('Generate stakeholder report')
  .action((idOrEmail, opts) => {
    const result = handlers.handleReportStakeholder(idOrEmail, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

report
  .command('security [id]')
  .description('Generate security class report')
  .action((id, opts) => {
    const result = handlers.handleReportSecurity(id, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// EXPORT COMMANDS
// ============================================
const exportCmd = program.command('export').description('Export cap table data');

exportCmd
  .command('csv')
  .description('Export to CSV format')
  .option('--output <file>', 'output file path', 'captable.csv')
  .option('--no-options', 'exclude option grants')
  .action((opts) => {
    const result = handlers.handleExportCsv(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

exportCmd
  .command('json')
  .description('Export to JSON format')
  .option('--output <file>', 'output file path', 'captable-export.json')
  .option('--pretty', 'pretty-print JSON')
  .action((opts) => {
    const result = handlers.handleExportJson(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

exportCmd
  .command('pdf')
  .description('Export to PDF format')
  .option('--output <file>', 'output file path', 'captable.pdf')
  .action((opts) => {
    const result = handlers.handleExportPdf(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// ============================================
// SYSTEM COMMANDS
// ============================================
program
  .command('init')
  .description('Initialize a new cap table')
  .option('--wizard', 'run interactive setup wizard')
  .option('--name <name>', 'company name')
  .option('--type <type>', 'entity type (c-corp, s-corp, or llc)', 'c-corp')
  .option('--state <state>', 'state of incorporation', 'DE')
  .option('--currency <currency>', 'currency code', 'USD')
  .option('--authorized <amount>', 'authorized shares/units', '10000000')
  .option('--par <value>', 'par value per share', '0.00001')
  .option('--pool-pct <pct>', 'option pool as % of fully diluted', '10')
  .option('--founder <founder...>', 'founder(s) in format "Name:email:shares"')
  .option('--date <date>', 'incorporation date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .action(async (opts) => {
    const result = await handlers.handleInit(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

program
  .command('validate')
  .description('Validate cap table data')
  .option('--extended', 'perform extended validation with business rules')
  .option('--file <file>', 'captable file to validate', 'captable.json')
  .action((opts) => {
    const result = handlers.handleValidate(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

program
  .command('schema')
  .description('Generate JSON schema file')
  .option('--output <file>', 'output file path', 'captable.schema.json')
  .action((opts) => {
    const result = handlers.handleSchema(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

program
  .command('log')
  .description('View audit log')
  .option('--action <action>', 'filter by action type')
  .option('--limit <number>', 'limit number of entries', '20')
  .action((opts) => {
    const result = handlers.handleLog(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(packageJson.version);
  });

program
  .command('help [command]')
  .description('Show help for a command')
  .action((command) => {
    if (command) {
      const cmd = program.commands.find((c) => c.name() === command);
      if (cmd) {
        cmd.outputHelp();
      } else {
        console.error(`Unknown command: ${command}`);
        program.outputHelp();
      }
    } else {
      program.outputHelp();
    }
  });

// Parse and execute
program.parseAsync(process.argv).catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
