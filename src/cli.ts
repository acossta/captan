#!/usr/bin/env node
import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { load, save, exists } from './store.js';
import { FileModel, Vesting, EntityType, getEntityDefaults } from './model.js';
import { LOGO, NAME, TAGLINE } from './branding.js';
import { StakeholderService } from './services/stakeholder-service.js';
import { SecurityService } from './services/security-service.js';
import { EquityService } from './services/equity-service.js';
import { ReportingService } from './services/reporting-service.js';
import { AuditService } from './services/audit-service.js';
import { SAFEService } from './services/safe-service.js';
import {
  runInitWizard,
  parseFounderString,
  calculatePoolFromPercentage,
  buildModelFromWizard,
} from './init-wizard.js';

const program = new Command();

program
  .name('captan')
  .description(`${NAME} — ${TAGLINE}`)
  .version('0.1.0')
  .showHelpAfterError('(use --help for usage)')
  .addHelpText('before', LOGO + '\n');

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
    if (exists('captable.json')) {
      console.error('❌ captable.json already exists');
      process.exit(1);
    }

    let model: FileModel;

    if (opts.wizard) {
      // Run interactive wizard
      const wizardResult = await runInitWizard();
      model = buildModelFromWizard(wizardResult);
    } else {
      // Use flags/defaults
      const entityTypeStr = (opts.type || 'c-corp').toUpperCase().replace('-', '_');
      const entityType = (
        entityTypeStr === 'C_CORP' || entityTypeStr === 'S_CORP' || entityTypeStr === 'LLC'
          ? entityTypeStr
          : 'C_CORP'
      ) as EntityType;

      const defaults = getEntityDefaults(entityType);
      const isCorp = entityType === 'C_CORP' || entityType === 'S_CORP';

      model = {
        version: 1,
        company: {
          id: `comp_${randomUUID()}`,
          name: opts.name || 'Untitled, Inc.',
          formationDate: opts.date,
          entityType,
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

      // Add common stock/units
      model.securityClasses.push({
        id: 'sc_common',
        kind: 'COMMON',
        label: isCorp ? 'Common Stock' : 'Common Units',
        authorized: Number(opts.authorized || defaults.authorized),
        parValue: isCorp ? Number(opts.par ?? defaults.parValue) : undefined,
      });

      // Parse and add founders
      let totalFounderShares = 0;
      const founders = opts.founder || [];
      for (const founderStr of founders) {
        try {
          const founder = parseFounderString(founderStr);
          const stakeholderId = `sh_${randomUUID()}`;

          model.stakeholders.push({
            id: stakeholderId,
            type: 'person',
            name: founder.name,
            email: founder.email,
          });

          if (founder.shares > 0) {
            model.issuances.push({
              id: `is_${randomUUID()}`,
              securityClassId: 'sc_common',
              stakeholderId,
              qty: founder.shares,
              pps: isCorp ? Number(opts.par ?? defaults.parValue) : 0,
              date: model.company.formationDate!,
            });
            totalFounderShares += founder.shares;
          }
        } catch {
          console.error(`❌ Invalid founder format: ${founderStr}`);
          console.error('   Use format: "Name:shares" or "Name:email:shares"');
          process.exit(1);
        }
      }

      // Add option pool
      let poolQty: number | undefined;
      if (opts.pool) {
        poolQty = Number(opts.pool);
      } else if (opts.poolPct && totalFounderShares > 0) {
        poolQty = calculatePoolFromPercentage(totalFounderShares, Number(opts.poolPct));
      }

      if (poolQty && poolQty > 0) {
        const currentYear = new Date().getFullYear();
        model.securityClasses.push({
          id: 'sc_pool',
          kind: 'OPTION_POOL',
          label: `${currentYear} Stock Option Plan`,
          authorized: poolQty,
        });
      }
    }

    // Add audit entry
    const auditService = new AuditService(model);
    auditService.logAction('INIT', {
      name: model.company.name,
      entityType: model.company.entityType,
      jurisdiction: model.company.jurisdiction,
      founders: model.stakeholders.length,
      pool: model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL')?.authorized || 0,
    });

    // Save and display results
    save(model);
    console.log('\n✅ Created captable.json');
    console.log(`⚓ ${NAME}: ${TAGLINE}`);

    const defaults = getEntityDefaults(model.company.entityType!);
    const commonClass = model.securityClasses.find((sc) => sc.kind === 'COMMON');
    const poolClass = model.securityClasses.find((sc) => sc.kind === 'OPTION_POOL');

    console.log(
      `\n🏢 Entity: ${model.company.entityType?.replace('_', '-')} (${model.company.jurisdiction})`
    );
    if (commonClass) {
      const parStr = commonClass.parValue ? ` @ $${commonClass.parValue} par` : '';
      console.log(
        `💰 Authorized: ${commonClass.authorized.toLocaleString()} ${defaults.unitsName.toLowerCase()}${parStr}`
      );
    }

    if (model.stakeholders.length > 0) {
      const founderNames = model.stakeholders.map((s) => s.name).join(', ');
      console.log(`👥 Founders: ${founderNames}`);
    }

    if (poolClass) {
      console.log(
        `🎯 Option Pool: ${poolClass.authorized.toLocaleString()} ${defaults.unitsName.toLowerCase()}`
      );
    }

    console.log('\nNext steps:');
    console.log('→ captan chart          View cap table');
    console.log('→ captan grant          Issue options');
    console.log('→ captan export csv     Export to spreadsheet');
  });

const enlist = program
  .command('enlist')
  .description('Add things to your crew (stakeholders, etc.)');

enlist
  .command('stakeholder')
  .alias('holder')
  .description('Add a stakeholder')
  .requiredOption('-n, --name <name>', 'stakeholder name')
  .option('-t, --type <type>', 'person|entity', 'person')
  .option('-e, --email <email>', 'email address')
  .action((opts) => {
    const model = load();
    const stakeholderService = new StakeholderService(model);
    const auditService = new AuditService(model);

    try {
      const stakeholder = stakeholderService.addStakeholder(opts.name, opts.type, opts.email);

      auditService.logAction('STAKEHOLDER_ADD', {
        id: stakeholder.id,
        name: stakeholder.name,
        type: stakeholder.type,
      });

      save(model);
      console.log(`👤 Enlisted stakeholder ${stakeholder.name} (${stakeholder.id})`);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('security:add')
  .alias('security')
  .description('Add a security class (COMMON|PREF|OPTION_POOL)')
  .requiredOption('-k, --kind <kind>', 'COMMON|PREF|OPTION_POOL')
  .requiredOption('-l, --label <label>', 'security class label')
  .requiredOption('-a, --authorized <qty>', 'authorized shares')
  .option('-p, --par <value>', 'par value')
  .action((opts) => {
    const model = load();
    const securityService = new SecurityService(model);
    const auditService = new AuditService(model);

    try {
      const sc = securityService.addSecurityClass(
        opts.kind,
        opts.label,
        Number(opts.authorized),
        opts.par ? Number(opts.par) : undefined
      );

      auditService.logAction('SECURITY_ADD', {
        id: sc.id,
        kind: sc.kind,
        label: sc.label,
        authorized: sc.authorized,
      });

      save(model);
      console.log(`🏷️  Added security class ${sc.label} (${sc.kind})`);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('issue')
  .description('Issue shares to a stakeholder')
  .requiredOption('-s, --security <securityClassId>', 'security class ID')
  .requiredOption('-h, --holder <stakeholderId>', 'stakeholder ID')
  .requiredOption('-q, --qty <qty>', 'quantity of shares')
  .option('-p, --pps <pricePerShare>', 'price per share', '0')
  .option('-d, --date <date>', 'issuance date', new Date().toISOString().slice(0, 10))
  .option('-c, --cert <certificate>', 'certificate number')
  .action((opts) => {
    const model = load();
    const equityService = new EquityService(model);
    const auditService = new AuditService(model);
    const stakeholderService = new StakeholderService(model);
    const securityService = new SecurityService(model);

    try {
      const issuance = equityService.issueShares(
        opts.security,
        opts.holder,
        Number(opts.qty),
        Number(opts.pps),
        opts.date,
        opts.cert
      );

      const stakeholder = stakeholderService.getStakeholder(opts.holder);
      const securityClass = securityService.getSecurityClass(opts.security);

      auditService.logAction('ISSUE', {
        id: issuance.id,
        securityClassId: opts.security,
        stakeholderId: opts.holder,
        qty: Number(opts.qty),
        pps: Number(opts.pps),
        date: opts.date,
      });

      save(model);
      console.log(
        `🧾 Issued ${opts.qty} shares of ${securityClass?.label} to ${stakeholder?.name}`
      );
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('grant')
  .description('Grant options with vesting')
  .requiredOption('-h, --holder <stakeholderId>', 'stakeholder ID')
  .requiredOption('-q, --qty <qty>', 'quantity of options')
  .requiredOption('-x, --exercise <price>', 'exercise price')
  .option('-g, --grant-date <date>', 'grant date', new Date().toISOString().slice(0, 10))
  .option('--start <date>', 'vesting start date')
  .option('--months <n>', 'total vesting months', '48')
  .option('--cliff <n>', 'cliff months', '12')
  .option('--no-vesting', 'grant without vesting')
  .action((opts) => {
    const model = load();
    const equityService = new EquityService(model);
    const auditService = new AuditService(model);
    const stakeholderService = new StakeholderService(model);

    try {
      let vesting: Vesting | undefined;
      if (opts.vesting) {
        vesting = {
          start: opts.start || opts.grantDate,
          monthsTotal: Number(opts.months),
          cliffMonths: Number(opts.cliff),
        };
      }

      const grant = equityService.grantOptions(
        opts.holder,
        Number(opts.qty),
        Number(opts.exercise),
        opts.grantDate,
        vesting
      );

      const stakeholder = stakeholderService.getStakeholder(opts.holder);

      auditService.logAction('GRANT', {
        id: grant.id,
        stakeholderId: opts.holder,
        qty: Number(opts.qty),
        exercise: Number(opts.exercise),
        grantDate: opts.grantDate,
        vesting,
      });

      save(model);
      console.log(`🪙  Granted ${opts.qty} options to ${stakeholder?.name}`);
      if (vesting) {
        console.log(
          `   Vesting: ${vesting.monthsTotal} months with ${vesting.cliffMonths} month cliff`
        );
      }
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('safe')
  .description('Add a SAFE (Simple Agreement for Future Equity)')
  .requiredOption('-h, --holder <stakeholderId>', 'stakeholder ID')
  .requiredOption('-a, --amount <amount>', 'investment amount')
  .option('-c, --cap <cap>', 'valuation cap')
  .option('-d, --discount <discount>', 'discount rate (e.g., 0.8 for 20% discount)')
  .option('-t, --type <type>', 'pre or post money SAFE', 'pre')
  .option('-n, --note <note>', 'note or description')
  .option('--date <date>', 'SAFE date', new Date().toISOString().slice(0, 10))
  .action((opts) => {
    const model = load();
    const safeService = new SAFEService(model);
    const auditService = new AuditService(model);
    const stakeholderService = new StakeholderService(model);

    try {
      const safe = safeService.addSAFE({
        stakeholderId: opts.holder,
        amount: Number(opts.amount),
        cap: opts.cap ? Number(opts.cap) : undefined,
        discount: opts.discount ? Number(opts.discount) : undefined,
        type: opts.type as 'pre' | 'post' | undefined,
        note: opts.note,
        date: opts.date,
      });

      const stakeholder = stakeholderService.getStakeholder(opts.holder);

      auditService.logAction('SAFE_ADD', {
        id: safe.id,
        stakeholderId: opts.holder,
        amount: Number(opts.amount),
        cap: opts.cap,
        discount: opts.discount,
        type: opts.type,
        date: opts.date,
      });

      save(model);

      const currency = model.company.currency || 'USD';
      console.log(`💰 Added SAFE for ${stakeholder?.name}`);
      console.log(`   Amount: ${currency} ${safe.amount.toLocaleString()}`);
      if (safe.cap) console.log(`   Cap: ${currency} ${safe.cap.toLocaleString()}`);
      if (safe.discount) console.log(`   Discount: ${Math.round((1 - safe.discount) * 100)}%`);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('safes')
  .description('List all SAFEs')
  .option('-f, --format <format>', 'output format (text|json)', 'text')
  .action((opts) => {
    const model = load();
    const safeService = new SAFEService(model);
    const currency = model.company.currency || 'USD';

    if (opts.format === 'json') {
      const summary = safeService.getSAFEsSummary();
      console.log(JSON.stringify(summary, null, 2));
    } else {
      const summary = safeService.getSAFEsSummary();

      if (summary.count === 0) {
        console.log('No SAFEs found');
        return;
      }

      console.log('\nSAFEs Outstanding');
      console.log('=================');

      for (const holder of summary.byStakeholder) {
        for (const safe of holder.safes) {
          const capStr = safe.cap ? `Cap: ${currency} ${safe.cap.toLocaleString()}` : '';
          const discountStr = safe.discount
            ? `Discount: ${Math.round((1 - safe.discount) * 100)}%`
            : '';
          const terms = [capStr, discountStr].filter(Boolean).join('  ');

          console.log(
            `${holder.stakeholderName.padEnd(20)} ${currency} ${safe.amount
              .toLocaleString()
              .padStart(10)}  ${terms}  Date: ${safe.date}`
          );
        }
      }

      console.log(`\nTotal: ${currency} ${summary.totalAmount.toLocaleString()}`);
    }
  });

program
  .command('convert')
  .description('Simulate SAFE conversion at a priced round')
  .requiredOption('--pre-money <valuation>', 'pre-money valuation')
  .requiredOption('--new-money <amount>', 'new money raised')
  .option('--pps <price>', 'price per share')
  .action((opts) => {
    const model = load();
    const safeService = new SAFEService(model);
    const currency = model.company.currency || 'USD';

    const roundTerms = {
      preMoneyValuation: Number(opts.preMoney),
      newMoneyRaised: Number(opts.newMoney),
      pricePerShare: opts.pps ? Number(opts.pps) : undefined,
    };

    const conversions = safeService.simulateConversion(roundTerms);

    if (conversions.length === 0) {
      console.log('No SAFEs to convert');
      return;
    }

    // Calculate or use provided price per share
    const currentShares = model.issuances.reduce((sum, i) => sum + i.qty, 0);
    const pps = roundTerms.pricePerShare || roundTerms.preMoneyValuation / currentShares;

    console.log('\nSAFE Conversion Simulation');
    console.log('==========================');
    console.log(`Round Terms: ${currency} ${Number(opts.preMoney).toLocaleString()} pre-money`);
    console.log(`             ${currency} ${Number(opts.newMoney).toLocaleString()} new money`);
    console.log(`             ${currency} ${pps.toFixed(2)}/share\n`);

    let totalShares = 0;
    for (const conv of conversions) {
      const reasonStr =
        conv.conversionReason === 'cap'
          ? '(cap price)'
          : conv.conversionReason === 'discount'
            ? '(discount price)'
            : '(round price)';

      console.log(
        `${conv.stakeholderName.padEnd(20)} ${currency} ${conv.investmentAmount
          .toLocaleString()
          .padStart(
            10
          )} → ${conv.sharesIssued.toLocaleString().padStart(10)} shares @ ${currency}${conv.conversionPrice.toFixed(2)} ${reasonStr}`
      );
      totalShares += conv.sharesIssued;
    }

    console.log(`\nTotal SAFE conversion: ${totalShares.toLocaleString()} shares`);
  });

program
  .command('chart')
  .description('Show cap table as of a date')
  .option('-d, --date <date>', 'as-of date', new Date().toISOString().slice(0, 10))
  .option('-f, --format <format>', 'output format (text|json)', 'text')
  .action((opts) => {
    const model = load();
    const reportingService = new ReportingService(model);

    if (opts.format === 'json') {
      const capTable = reportingService.generateCapTable(opts.date);
      console.log(JSON.stringify(capTable, null, 2));
    } else {
      const summary = reportingService.generateSummary(opts.date);
      console.log(summary);
    }
  });

program
  .command('export')
  .description('Export cap table data')
  .argument('<format>', 'csv|json')
  .option('--no-options', 'exclude option grants from CSV export')
  .action((format, opts) => {
    const model = load();
    const reportingService = new ReportingService(model);

    try {
      if (format === 'json') {
        console.log(reportingService.exportJSON());
      } else if (format === 'csv') {
        console.log(reportingService.exportCSV(opts.options));
      } else {
        throw new Error('Format must be csv or json');
      }
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate various reports')
  .argument('<type>', 'stakeholder|security|summary')
  .argument('[id]', 'stakeholder or security class ID')
  .action((type, id) => {
    const model = load();
    const reportingService = new ReportingService(model);

    try {
      switch (type) {
        case 'stakeholder':
          if (!id) {
            console.error('❌ Stakeholder ID required');
            process.exit(1);
          }
          console.log(reportingService.generateStakeholderReport(id));
          break;
        case 'security':
          if (!id) {
            console.error('❌ Security class ID required');
            process.exit(1);
          }
          console.log(reportingService.generateSecurityClassReport(id));
          break;
        case 'summary':
          console.log(reportingService.generateSummary());
          break;
        default:
          console.error('❌ Report type must be stakeholder, security, or summary');
          process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('log')
  .description("Show the ship's log (audit trail)")
  .option('-a, --action <action>', 'filter by action')
  .option('-l, --limit <n>', 'limit entries', '50')
  .option('-f, --format <format>', 'output format (text|json)', 'text')
  .action((opts) => {
    const model = load();
    const auditService = new AuditService(model);

    let entries = auditService.getAuditTrail();

    if (opts.action) {
      entries = entries.filter((e) => e.action === opts.action);
    }

    entries = entries.slice(-Number(opts.limit));

    if (opts.format === 'json') {
      console.log(JSON.stringify(entries, null, 2));
    } else {
      for (const entry of entries) {
        console.log(`[${entry.ts}] ${entry.action} - ${JSON.stringify(entry.data)}`);
      }
    }
  });

program
  .command('list')
  .description('List stakeholders or security classes')
  .argument('<type>', 'stakeholders|securities')
  .action((type) => {
    const model = load();

    if (type === 'stakeholders') {
      const stakeholderService = new StakeholderService(model);
      const stakeholders = stakeholderService.listStakeholders();

      if (stakeholders.length === 0) {
        console.log('No stakeholders found');
      } else {
        console.log('\nStakeholders:');
        console.log('=============');
        for (const s of stakeholders) {
          console.log(`${s.id}: ${s.name} (${s.type})${s.email ? ` - ${s.email}` : ''}`);
        }
      }
    } else if (type === 'securities') {
      const securityService = new SecurityService(model);
      const securities = securityService.listSecurityClasses();

      if (securities.length === 0) {
        console.log('No security classes found');
      } else {
        console.log('\nSecurity Classes:');
        console.log('=================');
        for (const sc of securities) {
          console.log(
            `${sc.id}: ${sc.label} (${sc.kind}) - ${sc.authorized.toLocaleString()} authorized`
          );
        }
      }
    } else {
      console.error('❌ Type must be stakeholders or securities');
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
