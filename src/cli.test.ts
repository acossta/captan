import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up after test
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    process.chdir(__dirname);
  });

  const runCLI = (args: string): string => {
    try {
      const output = execSync(`npx tsx ${cliPath} ${args}`, {
        encoding: 'utf8',
        cwd: testDir,
        stdio: 'pipe',
      });
      // Filter out npm warnings
      return output
        .split('\n')
        .filter((line: string) => !line.startsWith('npm warn'))
        .join('\n');
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      // Filter out npm warnings from error output too
      return errorOutput
        .split('\n')
        .filter((line: string) => !line.startsWith('npm warn'))
        .join('\n');
    }
  };

  describe('init command', () => {
    it('should create captable.json with default values', () => {
      const output = runCLI('init');

      expect(output).toContain('Created captable.json');
      expect(fs.existsSync(testFile)).toBe(true);

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.company.name).toBe('Untitled, Inc.');
      expect(model.company.entityType).toBe('C_CORP');
      expect(model.company.jurisdiction).toBe('DE');
      expect(model.securityClasses).toHaveLength(1); // Only common stock by default
      expect(model.securityClasses[0].kind).toBe('COMMON');
      expect(model.securityClasses[0].authorized).toBe(10000000);
    });

    it('should accept custom company name and pool size', () => {
      runCLI('init --name "Test Co" --pool 5000000');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.company.name).toBe('Test Co');
      expect(model.securityClasses[1].authorized).toBe(5000000);
    });

    it('should fail if captable.json already exists', () => {
      runCLI('init');
      const output = runCLI('init');

      expect(output).toContain('already exists');
    });
  });

  describe('stakeholder management', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should add a stakeholder', () => {
      const output = runCLI('enlist stakeholder --name "Alice Founder" --email alice@test.com');

      expect(output).toContain('Added stakeholder');
      expect(output).toContain('Alice Founder');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.stakeholders).toHaveLength(1);
      expect(model.stakeholders[0].name).toBe('Alice Founder');
      expect(model.stakeholders[0].email).toBe('alice@test.com');
    });

    it('should add an entity stakeholder', () => {
      runCLI('enlist stakeholder --name "Acme Inc" --entity');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.stakeholders[0].type).toBe('entity');
    });

    it('should list stakeholders', () => {
      runCLI('enlist stakeholder --name "Alice"');
      runCLI('enlist stakeholder --name "Bob"');

      const output = runCLI('list stakeholders');

      expect(output).toContain('Alice');
      expect(output).toContain('Bob');
      expect(output).toContain('person');
    });
  });

  describe('security class management', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should add a security class', () => {
      const output = runCLI('security:add --kind PREF --label "Series A" --authorized 5000000');

      expect(output).toContain('Added security class');
      expect(output).toContain('Series A');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const seriesA = model.securityClasses.find((sc: any) => sc.label === 'Series A');
      expect(seriesA).toBeDefined();
      expect(seriesA.kind).toBe('PREF');
      expect(seriesA.authorized).toBe(5000000);
    });

    it('should list security classes', () => {
      // Add a pool first so we have something to list
      runCLI(
        'security:add --kind OPTION_POOL --label "2024 Stock Option Plan" --authorized 2000000'
      );

      const output = runCLI('list securities');

      expect(output).toContain('Common Stock');
      expect(output).toContain('2024 Stock Option Plan');
      expect(output).toContain('COMMON');
      expect(output).toContain('OPTION_POOL');
    });
  });

  describe('equity issuance', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should issue shares', () => {
      runCLI('enlist stakeholder --name "Alice"');
      const model1 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const aliceId = model1.stakeholders[0].id;

      const output = runCLI(
        `issue --security sc_common --holder ${aliceId} --qty 1000000 --pps 0.0001`
      );

      expect(output).toContain('Issued');
      expect(output).toContain('1,000,000');

      const model2 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model2.issuances).toHaveLength(1);
      expect(model2.issuances[0].qty).toBe(1000000);
    });

    it('should grant options', () => {
      // Create an option pool first
      runCLI('security:add --kind OPTION_POOL --label "Stock Option Plan" --authorized 1000000');

      runCLI('enlist stakeholder --name "Bob"');
      const model1 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const bobId = model1.stakeholders[0].id;

      const output = runCLI(`grant --holder ${bobId} --qty 100000 --exercise 0.10`);

      expect(output).toContain('Granted');
      expect(output).toContain('100,000');

      const model2 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model2.optionGrants).toHaveLength(1);
      expect(model2.optionGrants[0].qty).toBe(100000);
    });
  });

  describe('reporting', () => {
    beforeEach(() => {
      runCLI('init');
      runCLI('enlist stakeholder --name "Alice"');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const aliceId = model.stakeholders[0].id;
      runCLI(`issue --security sc_common --holder ${aliceId} --qty 7000000`);
    });

    it('should show cap table chart', () => {
      const output = runCLI('chart');

      expect(output).toContain('Cap Table Summary');
      expect(output).toContain('Alice');
      expect(output).toContain('7,000,000');
    });

    it('should export as JSON', () => {
      const output = runCLI('export json');
      const parsed = JSON.parse(output);

      expect(parsed.company.name).toBe('Untitled, Inc.');
      expect(parsed.issuances).toHaveLength(1);
    });

    it('should export as CSV', () => {
      const output = runCLI('export csv');

      expect(output).toContain('stakeholder_name,stakeholder_id,type,security_class');
      expect(output).toContain('Alice');
      expect(output).toContain('ISSUANCE');
    });

    it('should show audit log', () => {
      const output = runCLI('log');

      expect(output).toContain('INIT');
      expect(output).toContain('STAKEHOLDER_ADD');
      expect(output).toContain('ISSUE');
    });
  });

  describe('SAFE conversion', () => {
    beforeEach(() => {
      runCLI('init --name "TestCo" --authorized 10000000');
      runCLI('enlist stakeholder --name "Angel Investor" --email angel@test.com');
      runCLI('enlist stakeholder --name "VC Fund" --email vc@test.com --entity');

      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const angelId = model.stakeholders.find((s: any) => s.name === 'Angel Investor').id;
      const vcId = model.stakeholders.find((s: any) => s.name === 'VC Fund').id;

      // Add SAFEs
      runCLI(`safe --holder ${angelId} --amount 50000 --cap 5000000 --discount 20`);
      runCLI(`safe --holder ${vcId} --amount 150000 --cap 8000000`);
    });

    it('should preview SAFE conversion with --dry-run', () => {
      const output = runCLI('convert --pre-money 10000000 --pps 2.00 --dry-run');

      expect(output).toContain('SAFE Conversion Preview');
      expect(output).toContain('Angel Investor');
      expect(output).toContain('VC Fund');
      expect(output).toContain('Investment: $');
      expect(output).toContain('New ownership:');
      expect(output).toContain('Total new shares:');
      expect(output).toContain('Dilution to existing:');

      // Verify SAFEs still exist after dry-run
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.safes).toHaveLength(2);
      expect(model.issuances).toHaveLength(0); // No shares issued
    });

    it('should execute actual SAFE conversion without --dry-run', () => {
      const output = runCLI('convert --pre-money 10000000 --pps 2.00');

      expect(output).toContain('SAFE Conversions Executed');
      expect(output).toContain('Angel Investor');
      expect(output).toContain('VC Fund');
      expect(output).toContain('ownership');

      // Verify SAFEs are gone and shares are issued
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.safes).toHaveLength(0); // SAFEs cleared
      expect(model.issuances.length).toBeGreaterThan(0); // Shares issued
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should handle invalid stakeholder ID', () => {
      const output = runCLI('issue --holder invalid_id --qty 1000');

      expect(output).toContain('Failed to issue shares');
    });

    it('should handle exceeding authorized shares', () => {
      runCLI('stakeholder --name "Alice"');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const aliceId = model.stakeholders[0].id;

      const output = runCLI(`issue --holder ${aliceId} --qty 20000000`);

      expect(output).toContain('Cannot issue');
    });
  });
});
