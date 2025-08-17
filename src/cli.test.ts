import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    process.chdir(__dirname);
  });

  const runCLI = (args: string): string => {
    try {
      return execSync(`npx tsx ${cliPath} ${args}`, {
        encoding: 'utf8',
        cwd: testDir
      });
    } catch (error: any) {
      return error.stdout || error.stderr || error.message;
    }
  };

  describe('init command', () => {
    it('should create captable.json with default values', () => {
      const output = runCLI('init');
      
      expect(output).toContain('Created captable.json');
      expect(fs.existsSync(testFile)).toBe(true);
      
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.company.name).toBe('Untitled, Inc.');
      expect(model.securityClasses).toHaveLength(2);
      expect(model.securityClasses[0].kind).toBe('COMMON');
      expect(model.securityClasses[1].kind).toBe('OPTION_POOL');
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
      
      expect(output).toContain('Enlisted stakeholder Alice Founder');
      
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.stakeholders).toHaveLength(1);
      expect(model.stakeholders[0].name).toBe('Alice Founder');
      expect(model.stakeholders[0].email).toBe('alice@test.com');
    });

    it('should add an entity stakeholder', () => {
      runCLI('enlist stakeholder --name "Acme Inc" --type entity');
      
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model.stakeholders[0].type).toBe('entity');
    });

    it('should list stakeholders', () => {
      runCLI('enlist stakeholder --name "Alice"');
      runCLI('enlist stakeholder --name "Bob"');
      
      const output = runCLI('list stakeholders');
      
      expect(output).toContain('Alice');
      expect(output).toContain('Bob');
      expect(output).toContain('(person)');
    });
  });

  describe('security class management', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should add a security class', () => {
      const output = runCLI('security:add --kind PREF --label "Series A" --authorized 5000000');
      
      expect(output).toContain('Added security class Series A');
      
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const seriesA = model.securityClasses.find((sc: any) => sc.label === 'Series A');
      expect(seriesA).toBeDefined();
      expect(seriesA.kind).toBe('PREF');
      expect(seriesA.authorized).toBe(5000000);
    });

    it('should list security classes', () => {
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
      
      const output = runCLI(`issue --security sc_common --holder ${aliceId} --qty 1000000 --pps 0.0001`);
      
      expect(output).toContain('Issued 1000000 shares');
      
      const model2 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(model2.issuances).toHaveLength(1);
      expect(model2.issuances[0].qty).toBe(1000000);
    });

    it('should grant options', () => {
      runCLI('enlist stakeholder --name "Bob"');
      const model1 = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const bobId = model1.stakeholders[0].id;
      
      const output = runCLI(`grant --holder ${bobId} --qty 100000 --exercise 0.10`);
      
      expect(output).toContain('Granted 100000 options');
      
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

  describe('error handling', () => {
    beforeEach(() => {
      runCLI('init');
    });

    it('should handle invalid stakeholder ID', () => {
      const output = runCLI('issue --security sc_common --holder invalid_id --qty 1000');
      
      expect(output).toContain('not found');
    });

    it('should handle exceeding authorized shares', () => {
      runCLI('enlist stakeholder --name "Alice"');
      const model = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const aliceId = model.stakeholders[0].id;
      
      const output = runCLI(`issue --security sc_common --holder ${aliceId} --qty 20000000`);
      
      expect(output).toContain('Cannot issue');
    });
  });
});