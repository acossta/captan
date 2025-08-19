import { describe, it, expect } from 'vitest';
import { NAME, TAGLINE, LOGO } from './branding.js';

describe('Branding', () => {
  it('should export NAME constant', () => {
    expect(NAME).toBe('Captan');
  });

  it('should export TAGLINE constant', () => {
    expect(TAGLINE).toBe('Command your ownership.');
  });

  it('should export LOGO constant with correct format', () => {
    expect(LOGO).toContain(NAME);
    expect(LOGO).toContain(TAGLINE);
    expect(LOGO).toContain('🧭');
  });
});
