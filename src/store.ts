import fs from 'node:fs';
import path from 'node:path';
import { FileModel, FileModelSchema, AuditEntry } from './model.js';

export function load(file = 'captable.json'): FileModel {
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}. Run 'captan init' to create a new cap table.`);
  }
  
  const content = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(content);
  
  return FileModelSchema.parse(data);
}

export function save(model: FileModel, file = 'captable.json'): void {
  ensureDirFor(file);
  fs.writeFileSync(file, JSON.stringify(model, null, 2));
}

export function audit(model: FileModel, action: string, data: any, by = 'cli'): void {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    by,
    action,
    data
  };
  
  model.audit.push(entry);
}

export function ensureDirFor(file: string): void {
  const dir = path.dirname(path.resolve(file));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function exists(file: string): boolean {
  return fs.existsSync(file);
}