import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, 'cli.ts');
const testDir = path.join(__dirname, '..', 'test-output');
const testFile = path.join(testDir, 'captable.json');

describe('CLI Integration Tests', () => {
  beforeEach(() => {
    // Clean up any existing files first
    fs.rmSync(testFile, { force: true });
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    // Switch back to the repo dir to release testDir handles (prevents EBUSY on Windows)
    process.chdir(__dirname);
  });

  afterAll(() => {
    // Clean up the test directory after all tests complete
    // Be defensive: ensure we are not inside testDir before removing it
    try {
      process.chdir(__dirname);
    } catch {}
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Helper to filter out transient noise from command output
  function stripNoise(output: string): string {
    return output
      .split('\n')
      .filter((line: string) => !/^(npm WARN|npm notice|npx:)/i.test(line))
      .join('\n')
      .trim();
  }

  const runCLI = (args: string): string => {
    try {
      const output = execSync(`node --import tsx "${cliPath}" ${args}`, {
        encoding: 'utf8',
        cwd: testDir,
        stdio: 'pipe',
      });
      // Filter out npm warnings/notices and npx chatter
      return stripNoise(output);
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      // Filter out npm warnings/notices and npx chatter from error output too
      return stripNoise(errorOutput);
    }
  };

  describe('init command', () => {
    it('should create captable.json with default values', () => {
      const output = runCLI('init --name "Test Company"');

      expect(output).toContain('Initialized cap table');
      expect(fs.existsSync(testFile)).toBe(true);

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.company.name).toBe('Test Company');
      expect(model.company.entityType).toBe('C_CORP');
      expect(model.company.jurisdiction).toBe('DE');
      expect(model.securityClasses).toHaveLength(2); // Common stock + option pool by default
      expect(model.securityClasses[0].kind).toBe('COMMON');
      expect(model.securityClasses[0].authorized).toBe(10000000);
    });

    it('should accept custom company name and pool size', () => {
      runCLI('init --name "Test Co" --pool-pct 50');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.company.name).toBe('Test Co');
      expect(model.securityClasses[1].authorized).toBe(5000000); // 50% of 10M
    });

    it('should fail if captable.json already exists', () => {
      runCLI('init --name "First Company"');
      const output = runCLI('init --name "Second Company"');

      expect(output).toContain('already exists');
    });
  });

  describe('stakeholder management', () => {
    beforeEach(() => {
      runCLI('init --name "Test Company"');
    });

    it('should add a stakeholder', () => {
      const output = runCLI('stakeholder add --name "Alice Founder" --email alice@test.com');

      expect(output).toContain('Added stakeholder');
      expect(output).toContain('Alice Founder');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.stakeholders).toHaveLength(1);
      expect(model.stakeholders[0].name).toBe('Alice Founder');
      expect(model.stakeholders[0].email).toBe('alice@test.com');
    });

    it('should add an entity stakeholder', () => {
      runCLI('stakeholder add --name "Acme Inc" --entity ENTITY');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.stakeholders[0].type).toBe('entity');
    });

    it('should list stakeholders', () => {
      runCLI('stakeholder add --name "Alice"');
      runCLI('stakeholder add --name "Bob"');

      const output = runCLI('stakeholder list');

      expect(output).toContain('Alice');
      expect(output).toContain('Bob');
      expect(output).toContain('PERSON');
    });
  });

  describe('security class management', () => {
    beforeEach(() => {
      runCLI('init --name "Test Company"');
    });

    it('should add a security class', () => {
      const output = runCLI(
        'security add --kind PREFERRED --label "Series A" --authorized 5000000'
      );

      expect(output).toContain('Added security class');
      expect(output).toContain('Series A');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const seriesA = model.securityClasses.find((sc: any) => sc.label === 'Series A');
      expect(seriesA).toBeDefined();
      expect(seriesA.kind).toBe('PREF');
      expect(seriesA.authorized).toBe(5000000);
    });

    it('should list security classes', () => {
      // Add a preferred class
      runCLI('security add --kind PREFERRED --label "Series A Preferred" --authorized 2000000');

      const output = runCLI('security list');

      expect(output).toContain('Common Stock');
      expect(output).toContain('Series A Preferred');
      expect(output).toContain('COMMON');
      expect(output).toContain('PREF');
    });
  });

  describe('equity issuance', () => {
    beforeEach(() => {
      runCLI('init --name "Test Company"');
    });

    it('should issue shares', () => {
      runCLI('stakeholder add --name "Alice" --email alice@test.com');
      const model1 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const commonSecurityId = model1.securityClasses.find((sc: any) => sc.kind === 'COMMON').id;

      const output = runCLI(
        `issuance add --stakeholder alice@test.com --security ${commonSecurityId} --qty 1000000 --pps 0.0001`
      );

      expect(output).toContain('Issued');
      expect(output).toContain('1,000,000');

      const model2 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model2.issuances).toHaveLength(1);
      expect(model2.issuances[0].qty).toBe(1000000);
    });

    it('should grant options', () => {
      runCLI('stakeholder add --name "Bob" --email bob@test.com');

      const output = runCLI(`grant add --stakeholder bob@test.com --qty 100000 --exercise 0.10`);

      expect(output).toContain('Granted');
      expect(output).toContain('100,000');

      const model2 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model2.optionGrants).toHaveLength(1);
      expect(model2.optionGrants[0].qty).toBe(100000);
    });
  });

  describe('reporting', () => {
    beforeEach(() => {
      runCLI('init --name "Test Company"');
      runCLI('stakeholder add --name "Alice" --email alice@test.com');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const commonSecurityId = model.securityClasses.find((sc: any) => sc.kind === 'COMMON').id;
      runCLI(
        `issuance add --stakeholder alice@test.com --security ${commonSecurityId} --qty 7000000`
      );
    });

    it('should show cap table chart', () => {
      const output = runCLI('report summary');

      expect(output).toContain('Cap Table Summary');
      expect(output).toContain('Test Company');
      expect(output).toContain('7,000,000');
    });

    it('should export as JSON', () => {
      const output = runCLI('export json --output export-test.json');

      expect(output).toContain('Exported cap table');
      expect(fs.existsSync(path.join(testDir, 'export-test.json'))).toBe(true);

      const exported = JSON.parse(fs.readFileSync(path.join(testDir, 'export-test.json'), 'utf8'));
      expect(exported.company.name).toBe('Test Company');
      expect(exported.issuances).toHaveLength(1);
    });

    it('should export as CSV', () => {
      const output = runCLI('export csv --output export-test.csv');

      expect(output).toContain('Exported cap table');
      expect(fs.existsSync(path.join(testDir, 'export-test.csv'))).toBe(true);

      const csvContent = fs.readFileSync(path.join(testDir, 'export-test.csv'), 'utf8');
      expect(csvContent).toContain('Name');
      expect(csvContent).toContain('Alice');
    });

    it('should show audit log', () => {
      const output = runCLI('log');

      expect(output).toContain('INIT');
      expect(output).toContain('STAKEHOLDER_ADD');
      expect(output).toContain('ISSUANCE_ADD');
    });
  });

  describe('SAFE conversion', () => {
    beforeEach(() => {
      runCLI('init --name "TestCo" --authorized 10000000');
      runCLI('stakeholder add --name "Angel Investor" --email angel@test.com');
      runCLI('stakeholder add --name "VC Fund" --email vc@test.com --entity ENTITY');

      // Add SAFEs
      runCLI(`safe add --stakeholder angel@test.com --amount 50000 --cap 5000000 --discount 20`);
      runCLI(`safe add --stakeholder vc@test.com --amount 150000 --cap 8000000`);
    });

    it('should preview SAFE conversion with --dry-run', () => {
      const output = runCLI('safe convert --pre-money 10000000 --pps 2.00 --dry-run');

      expect(output).toContain('SAFE Conversion');
      expect(output).toContain('Angel Investor');
      expect(output).toContain('VC Fund');

      // Verify SAFEs still exist after dry-run
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.safes).toHaveLength(2);
      expect(model.issuances).toHaveLength(0); // No shares issued
    });

    it('should execute actual SAFE conversion without --dry-run', () => {
      const output = runCLI('safe convert --pre-money 10000000 --pps 2.00');

      expect(output).toContain('Converted');
      expect(output).toContain('SAFE');

      // Verify SAFEs are gone and shares are issued
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.safes).toHaveLength(0); // SAFEs cleared
      expect(model.issuances.length).toBeGreaterThan(0); // Shares issued
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      runCLI('init --name "Test Company"');
    });

    it('should handle invalid stakeholder ID', () => {
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const commonSecurityId = model.securityClasses.find((sc: any) => sc.kind === 'COMMON').id;
      const output = runCLI(
        `issuance add --stakeholder invalid@email.com --security ${commonSecurityId} --qty 1000`
      );

      expect(output).toContain('No stakeholder found');
    });

    it('should handle exceeding authorized shares', () => {
      runCLI('stakeholder add --name "Alice" --email alice@test.com');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const commonSecurityId = model.securityClasses.find((sc: any) => sc.kind === 'COMMON').id;

      const output = runCLI(
        `issuance add --stakeholder alice@test.com --security ${commonSecurityId} --qty 20000000`
      );

      expect(output).toContain('exceed');
    });
  });

  describe('safes command', () => {
    beforeEach(() => {
      runCLI('init --name "Test Inc" --authorized 10000000 --state DE');
    });

    it('should list all SAFEs', () => {
      runCLI('stakeholder add --name "Investor 1" --email investor1@test.com');
      runCLI('stakeholder add --name "Investor 2" --email investor2@test.com');

      runCLI(
        `safe add --stakeholder investor1@test.com --amount 100000 --type post-money --cap 5000000`
      );
      runCLI(`safe add --stakeholder investor2@test.com --amount 250000 --cap 8000000`);

      const output = runCLI('safe list');

      expect(output).toContain('Investor 1');
      expect(output).toContain('100,000');
      expect(output).toContain('Investor 2');
      expect(output).toContain('250,000');
    });

    it('should handle no SAFEs gracefully', () => {
      const output = runCLI('safe list');
      expect(output).toContain('No SAFEs');
    });
  });

  describe('report command', () => {
    beforeEach(() => {
      runCLI('init --name "Test Inc" --authorized 10000000 --pool-pct 10 --state DE');
    });

    it('should generate stakeholder report', () => {
      runCLI('stakeholder add --name "Alice" --email alice@test.com');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const commonSecurityId = model.securityClasses.find((sc: any) => sc.kind === 'COMMON').id;
      runCLI(
        `issuance add --stakeholder alice@test.com --security ${commonSecurityId} --qty 1000000`
      );

      const output = runCLI(`report stakeholder alice@test.com`);

      expect(output).toContain('Alice');
      expect(output).toContain('alice@test.com');
      expect(output).toContain('1,000,000');
    });

    it('should generate security class report', () => {
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const optionPoolId = model.securityClasses.find((sc: any) => sc.kind === 'OPTION_POOL').id;
      const output = runCLI(`report security ${optionPoolId}`);

      expect(output).toContain('Option Pool');
      expect(output).toContain('OPTION_POOL');
    });
  });

  describe('list command', () => {
    beforeEach(() => {
      runCLI('init --name "Test Inc" --authorized 10000000 --pool-pct 10 --state DE');
    });

    it('should list stakeholders', () => {
      runCLI('stakeholder add --name "Person 1" --email person1@test.com');
      runCLI('stakeholder add --name "Company 1" --email company1@test.com --entity ENTITY');

      const output = runCLI('stakeholder list');

      expect(output).toContain('Person 1');
      expect(output).toContain('PERSON');
      expect(output).toContain('Company 1');
      expect(output).toContain('ENTITY');
    });

    it('should list securities', () => {
      const output = runCLI('security list');

      expect(output).toContain('Common Stock');
      expect(output).toContain('COMMON');
      expect(output).toContain('Option Pool');
      expect(output).toContain('OPTION_POOL');
    });
  });

  describe('validate command', () => {
    beforeEach(() => {
      runCLI('init --name "Test Inc" --authorized 10000000 --state DE');
    });

    it('should validate a valid cap table', () => {
      runCLI('stakeholder add --name "Founder" --email founder@test.com');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const commonSecurityId = model.securityClasses.find((sc: any) => sc.kind === 'COMMON').id;
      runCLI(
        `issuance add --stakeholder founder@test.com --security ${commonSecurityId} --qty 1000000`
      );

      const output = runCLI('validate');

      expect(output).toContain('passed');
      expect(output).not.toContain('❌');
    });

    it('should validate with extended validation', () => {
      const output = runCLI('validate --extended');

      expect(output).toContain('Business rule violations');
      // Extended validation performs additional business rule checks
    });
  });

  describe('schema command', () => {
    it('should export schema to default file', () => {
      const schemaFile = path.join(testDir, 'captable.schema.json');

      // Remove schema file if it exists
      fs.rmSync(schemaFile, { force: true });

      const output = runCLI('schema');

      expect(output).toContain('Schema written');
      expect(fs.existsSync(schemaFile)).toBe(true);

      const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
      expect(schema).toHaveProperty('$schema');
    });

    it('should export schema to custom file', () => {
      const customFile = 'custom-schema.json';

      // Remove custom file if it exists
      fs.rmSync(path.join(testDir, customFile), { force: true });

      const output = runCLI(`schema --output ${customFile}`);

      expect(output).toContain('Schema written');
      expect(output).toContain('custom-schema.json');
      expect(fs.existsSync(path.join(testDir, customFile))).toBe(true);
    });
  });
});
