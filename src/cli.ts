#!/usr/bin/env node
import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { load, save, exists } from './store.js';
import { FileModel, Vesting } from './model.js';
import { LOGO, NAME, TAGLINE } from './branding.js';
import { StakeholderService } from './services/stakeholder-service.js';
import { SecurityService } from './services/security-service.js';
import { EquityService } from './services/equity-service.js';
import { ReportingService } from './services/reporting-service.js';
import { AuditService } from './services/audit-service.js';

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
  .option('-n, --name <name>', 'company name', 'Untitled, Inc.')
  .option('-p, --pool <qty>', 'option pool authorized', '2000000')
  .action((opts) => {
    if (exists('captable.json')) {
      console.error('❌ captable.json already exists');
      process.exit(1);
    }

    const model: FileModel = {
      version: 1,
      company: {
        id: `comp_${randomUUID()}`,
        name: opts.name,
        formationDate: new Date().toISOString().slice(0, 10),
      },
      stakeholders: [],
      securityClasses: [
        {
          id: 'sc_common',
          kind: 'COMMON',
          label: 'Common Stock',
          authorized: 10000000,
          parValue: 0.0001,
        },
        {
          id: 'sc_pool',
          kind: 'OPTION_POOL',
          label: '2024 Stock Option Plan',
          authorized: Number(opts.pool),
        },
      ],
      issuances: [],
      optionGrants: [],
      valuations: [],
      audit: [],
    };

    const auditService = new AuditService(model);
    auditService.logAction('INIT', { name: opts.name, pool: Number(opts.pool) });

    save(model);
    console.log('✅ Created captable.json');
    console.log(`⚓ ${NAME}: ${TAGLINE}`);
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
