import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { load, save, audit, ensureDirFor, exists } from './store.js';
import { FileModel } from './model.js';

vi.mock('node:fs');

describe('store', () => {
  const mockModel: FileModel = {
    version: 1,
    company: { id: 'comp_1', name: 'Test Co' },
    stakeholders: [],
    securityClasses: [],
    issuances: [],
    optionGrants: [],
    valuations: [],
    audit: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should load and parse a valid file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockModel));

      const result = load('test.json');

      expect(fs.existsSync).toHaveBeenCalledWith('test.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8');
      expect(result).toEqual(mockModel);
    });

    it('should throw if file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => load('missing.json')).toThrow(
        "File not found: missing.json. Run 'captan init' to create a new cap table."
      );
    });

    it('should use default filename', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockModel));

      load();

      expect(fs.existsSync).toHaveBeenCalledWith('captable.json');
    });

    it('should validate data with Zod schema', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          version: 1,
          company: { id: 'comp_1', name: 'Test' },
          stakeholders: [{ id: 'sh_1', type: 'invalid', name: 'Alice' }],
          securityClasses: [],
          issuances: [],
          optionGrants: [],
          valuations: [],
          audit: [],
        })
      );

      expect(() => load('invalid.json')).toThrow();
    });
  });

  describe('save', () => {
    it('should save model to file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      save(mockModel, 'output.json');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'output.json',
        JSON.stringify(mockModel, null, 2)
      );
    });

    it('should use default filename', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      save(mockModel);

      expect(fs.writeFileSync).toHaveBeenCalledWith('captable.json', expect.any(String));
    });

    it('should ensure directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      save(mockModel, 'nested/dir/file.json');

      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('audit', () => {
    it('should add audit entry to model', () => {
      const model = { ...mockModel, audit: [] };
      const data = { test: 'data' };

      audit(model, 'TEST_ACTION', data);

      expect(model.audit).toHaveLength(1);
      expect(model.audit[0]).toMatchObject({
        action: 'TEST_ACTION',
        data,
        by: 'cli',
      });
      expect(model.audit[0].ts).toBeDefined();
    });

    it('should use custom by parameter', () => {
      const model = { ...mockModel, audit: [] };

      audit(model, 'TEST', {}, 'custom-user');

      expect(model.audit[0].by).toBe('custom-user');
    });
  });

  describe('ensureDirFor', () => {
    it('should create directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      ensureDirFor('nested/dir/file.json');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('nested/dir'), {
        recursive: true,
      });
    });

    it('should not create directory if it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      ensureDirFor('existing/file.json');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true if file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(exists('file.json')).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith('file.json');
    });

    it('should return false if file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(exists('missing.json')).toBe(false);
    });
  });
});
