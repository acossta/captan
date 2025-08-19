#!/usr/bin/env node
import { Command } from 'commander';
import { LOGO, NAME, TAGLINE } from './branding.js';
import * as handlers from './cli-handlers.js';
import { exists } from './store.js';

const program = new Command();

program
  .name('captan')
  .description(`${NAME} — ${TAGLINE}`)
  .version('0.1.0')
  .showHelpAfterError('(use --help for usage)')
  .addHelpText('before', LOGO + '\n');

// Init command
program
  .command('init')
  .description('Initialize a new captable.json')
  .option('-n, --name <name>', 'company name')
  .option('-t, --type <type>', 'entity type: c-corp, s-corp, or llc')
  .option('-s, --state <state>', 'state of incorporation (e.g., DE)')
  .option('-c, --currency <currency>', 'currency code (e.g., USD)')
  .option('-a, --authorized <qty>', 'authorized shares/units')
  .option('--par <value>', 'par value per share (corps only)')
  .option('--pool <qty>', 'option pool size (absolute number)')
  .option('--pool-pct <pct>', 'option pool as % of fully diluted')
  .option('-f, --founder <founder...>', 'founder(s) in format "Name:shares" or "Name:email:shares"')
  .option(
    '-d, --date <date>',
    'incorporation date (YYYY-MM-DD)',
    new Date().toISOString().slice(0, 10)
  )
  .option('-w, --wizard', 'run interactive setup wizard')
  .action(async (opts) => {
    const result = await handlers.handleInit(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Enlist command with subcommands
const enlistCmd = program.command('enlist').description('Manage stakeholders');

// Enlist stakeholder subcommand - Add a stakeholder
enlistCmd
  .command('stakeholder')
  .alias('sh')
  .description('Add a stakeholder (person or entity)')
  .requiredOption('-n, --name <name>', 'stakeholder name')
  .option('-e, --email <email>', 'email address')
  .option('--entity', 'mark as entity (not individual)')
  .action((opts) => {
    const result = handlers.handleStakeholder(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Standalone stakeholder command for backwards compatibility (alias)
program
  .command('stakeholder')
  .alias('sh')
  .description('Add a stakeholder (alias for enlist stakeholder)')
  .requiredOption('-n, --name <name>', 'stakeholder name')
  .option('-e, --email <email>', 'email address')
  .option('--entity', 'mark as entity (not individual)')
  .action((opts) => {
    const result = handlers.handleStakeholder(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Security add command
program
  .command('security:add')
  .description('Add a security class')
  .requiredOption('-k, --kind <kind>', 'security type: common, preferred, or pool')
  .requiredOption('-l, --label <label>', 'display label')
  .requiredOption('-a, --authorized <qty>', 'authorized shares/units')
  .option('-p, --par <value>', 'par value per share')
  .action((opts) => {
    const result = handlers.handleSecurityAdd(opts.kind, opts.label, opts.authorized, opts.par);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Issue command
program
  .command('issue')
  .description('Issue shares')
  .requiredOption('--holder <id>', 'stakeholder ID')
  .option('--security <id>', 'security class ID (defaults to common)')
  .requiredOption('-q, --qty <amount>', 'number of shares')
  .option('--pps <amount>', 'price per share')
  .option('-d, --date <date>', 'issuance date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .action((opts) => {
    // Map to handler's expected params
    const mappedOpts = {
      stakeholder: opts.holder,
      securityClass: opts.security,
      qty: opts.qty,
      price: opts.pps,
      date: opts.date,
    };
    const result = handlers.handleIssue(mappedOpts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Grant command
program
  .command('grant')
  .description('Grant options')
  .requiredOption('--holder <id>', 'stakeholder ID')
  .option('-p, --pool <id>', 'option pool ID (defaults to first pool)')
  .requiredOption('-q, --qty <amount>', 'number of options')
  .requiredOption('-e, --exercise <price>', 'exercise price per share')
  .option('-d, --date <date>', 'grant date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .option('--months <months>', 'total vesting period in months')
  .option('--cliff <months>', 'cliff period in months')
  .option('--vest-start <date>', 'vesting start date (defaults to grant date)')
  .option('--no-vesting', 'grant without vesting schedule')
  .action((opts) => {
    // Map to handler's expected params
    const mappedOpts = {
      stakeholder: opts.holder,
      pool: opts.pool,
      qty: opts.qty,
      exercise: opts.exercise,
      date: opts.date,
      vestMonths: opts.noVesting ? undefined : opts.months,
      vestCliff: opts.noVesting ? undefined : opts.cliff,
      vestStart: opts.noVesting ? undefined : opts.vestStart,
    };
    const result = handlers.handleGrant(mappedOpts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// SAFE command
program
  .command('safe')
  .description('Add a SAFE')
  .requiredOption('--holder <id>', 'stakeholder ID')
  .requiredOption('-a, --amount <amount>', 'investment amount')
  .option('-c, --cap <amount>', 'valuation cap')
  .option('--discount <pct>', 'discount percentage (e.g., 20 for 20%)')
  .option('--post-money', 'use post-money SAFE calculation')
  .option(
    '-d, --date <date>',
    'investment date (YYYY-MM-DD)',
    new Date().toISOString().slice(0, 10)
  )
  .option('-n, --note <note>', 'optional note')
  .action((opts) => {
    // Map to handler's expected params
    const mappedOpts = {
      stakeholder: opts.holder,
      amount: opts.amount,
      cap: opts.cap,
      discount: opts.discount,
      postMoney: opts.postMoney,
      date: opts.date,
      note: opts.note,
    };
    const result = handlers.handleSAFE(mappedOpts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// SAFEs list command
program
  .command('safes')
  .description('List all SAFEs with details')
  .action(() => {
    const result = handlers.handleSafes();
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Convert command
program
  .command('convert')
  .description('Convert all SAFEs at a given price')
  .option('--pre-money <amount>', 'pre-money valuation')
  .option('--new-money <amount>', 'new money raised')
  .option('--pps <price>', 'price per share for conversion')
  .option('--price <price>', 'price per share (alias for --pps)')
  .option(
    '-d, --date <date>',
    'conversion date (YYYY-MM-DD)',
    new Date().toISOString().slice(0, 10)
  )
  .option('--post-money', 'use post-money calculation')
  .option('--dry-run', 'preview conversion without executing')
  .action((opts) => {
    // Use pps or price, whichever is provided
    const price = opts.pps || opts.price;
    if (!price && !opts.preMoney) {
      console.error('Error: Must provide either --pps/--price or --pre-money');
      process.exit(1);
    }
    const mappedOpts = {
      price: price,
      preMoney: opts.preMoney,
      newMoney: opts.newMoney,
      date: opts.date,
      postMoney: opts.postMoney,
      dryRun: opts.dryRun,
    };
    const result = handlers.handleConvert(mappedOpts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Chart command
program
  .command('chart')
  .description('Display cap table chart')
  .option('-d, --date <date>', 'as-of date (YYYY-MM-DD)')
  .option('-f, --format <format>', 'output format')
  .action((opts) => {
    const result = handlers.handleChart(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Export command
program
  .command('export')
  .description('Export cap table data')
  .argument('<format>', 'export format: json, csv, or summary')
  .option('--no-options', 'exclude option grants from CSV export')
  .action((format, opts) => {
    const result = handlers.handleExport(format, opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Report command
program
  .command('report')
  .description('Generate detailed reports')
  .argument('<type>', 'report type: stakeholder, security, or summary')
  .argument('[id]', 'entity ID to report on (not needed for summary)')
  .action((type, id) => {
    // Summary doesn't require an ID
    if (type === 'summary' && !id) {
      id = '';
    } else if (type !== 'summary' && !id) {
      console.error('Error: ID is required for stakeholder and security reports');
      process.exit(1);
    }
    const result = handlers.handleReport({ type, id });
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Log command
program
  .command('log')
  .alias('audit')
  .description('Show audit log')
  .option('-l, --limit <count>', 'number of entries to show', '20')
  .option('-a, --action <action>', 'filter by action type')
  .action((opts) => {
    const result = handlers.handleLog(opts);
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('List entities')
  .argument('<type>', 'entity type: stakeholders, securities/classes, or safes')
  .action((type) => {
    // Map 'securities' to 'classes' for backwards compatibility
    const mappedType = type === 'securities' ? 'classes' : type;
    const result = handlers.handleList({ type: mappedType });
    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  });

// Helper function to check if captable exists for commands that need it
function ensureCaptableExists() {
  if (!exists('captable.json')) {
    console.error('❌ No captable.json found. Run "captan init" first.');
    process.exit(1);
  }
}

// Add pre-action hook for commands that need existing captable
const commandsThatNeedCaptable = [
  'stakeholder',
  'security:add',
  'issue',
  'grant',
  'safe',
  'safes',
  'convert',
  'chart',
  'export',
  'report',
  'log',
  'list',
  'enlist',
];

program.commands.forEach((cmd) => {
  if (commandsThatNeedCaptable.includes(cmd.name())) {
    cmd.hook('preAction', ensureCaptableExists);
  }
});

// Parse and execute
program.parseAsync(process.argv).catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
