import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, 'cli.ts');

describe('CLI Version and Help Commands', () => {
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
        cwd: __dirname,
      });
      return stripNoise(output);
    } catch (error: any) {
      return stripNoise(error.stdout || error.stderr || error.message);
    }
  };

  it('should display version with --version flag', () => {
    const output = runCLI('--version');
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    );
    expect(output).toBe(packageJson.version);
  });

  it('should display version with -V flag', () => {
    const output = runCLI('-V');
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    );
    expect(output).toBe(packageJson.version);
  });

  it('should display help with --help flag', () => {
    const output = runCLI('--help');
    expect(output).toContain('Captan');
    expect(output).toContain('Usage:');
    expect(output).toContain('Options:');
    expect(output).toContain('Commands:');
    expect(output).toContain('--version');
  });

  it('should display help with -h flag', () => {
    const output = runCLI('-h');
    expect(output).toContain('Captan');
    expect(output).toContain('Usage:');
  });
});
