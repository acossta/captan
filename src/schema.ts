import { zodToJsonSchema } from 'zod-to-json-schema';
import { FileModelSchema, FileModel } from './model.js';
import { z } from 'zod';

// Schema version tracking
export const CURRENT_SCHEMA_VERSION = 1;
export const MIN_SUPPORTED_VERSION = 1;
export const MAX_SUPPORTED_VERSION = 1;

export interface ValidationWarning {
  path: string;
  message: string;
  severity: 'warning' | 'info';
}

export interface ExtendedValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: ValidationWarning[];
}

export interface SchemaVersion {
  version: number;
  releaseDate: string;
  breaking: boolean;
  changes: string[];
}

// Version history for documentation
export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 1,
    releaseDate: '2024-01-01',
    breaking: false,
    changes: [
      'Initial schema version',
      'Support for stakeholders, securities, issuances, options, and SAFEs',
      'Basic validation rules',
    ],
  },
];

export function generateJsonSchema() {
  const jsonSchema = zodToJsonSchema(FileModelSchema, {
    name: 'CaptableSchema',
    $refStrategy: 'none',
    errorMessages: true,
  });

  const schema = {
    $schema: 'https://json-schema.org/draft-07/schema#',
    $id: 'https://github.com/acossta/captan/schemas/captable.schema.json',
    title: 'Captan Captable Schema',
    description: 'JSON Schema for Captan captable.json files',
    ...jsonSchema,
  };

  return schema;
}

export function getSchemaString(): string {
  return JSON.stringify(generateJsonSchema(), null, 2);
}

export function validateCaptable(data: unknown): {
  valid: boolean;
  errors?: string[];
} {
  try {
    FileModelSchema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => {
        const path = e.path.join('.');
        return `${path}: ${e.message}`;
      });
      return { valid: false, errors };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Perform extended validation including business rules and cross-entity checks
 */
/**
 * Check if a schema version is supported
 */
export function isVersionSupported(version: number): boolean {
  return version >= MIN_SUPPORTED_VERSION && version <= MAX_SUPPORTED_VERSION;
}

/**
 * Get migration instructions for upgrading between versions
 */
export function getMigrationInstructions(_fromVersion: number, _toVersion: number): string[] {
  const instructions: string[] = [];

  // Add migration instructions as we add new versions
  // Example for future versions:
  // if (_fromVersion < 2 && _toVersion >= 2) {
  //   instructions.push('Add new required field X to all entities');
  // }

  return instructions;
}

export function validateCaptableExtended(data: unknown): ExtendedValidationResult {
  // First, perform basic schema validation
  const basicValidation = validateCaptable(data);
  if (!basicValidation.valid) {
    return {
      valid: false,
      errors: basicValidation.errors,
    };
  }

  const model = data as FileModel;
  const errors: string[] = [];
  const warnings: ValidationWarning[] = [];

  // Check schema version
  if (!isVersionSupported(model.version)) {
    if (model.version < MIN_SUPPORTED_VERSION) {
      errors.push(
        `Schema version ${model.version} is too old. Minimum supported version is ${MIN_SUPPORTED_VERSION}. Please migrate your data.`
      );
    } else if (model.version > MAX_SUPPORTED_VERSION) {
      errors.push(
        `Schema version ${model.version} is newer than supported. Maximum supported version is ${MAX_SUPPORTED_VERSION}. Please update captan.`
      );
    }
  }

  // Warn if not using current version
  if (model.version !== CURRENT_SCHEMA_VERSION && model.version >= MIN_SUPPORTED_VERSION) {
    warnings.push({
      path: 'version',
      message: `Schema version ${model.version} is supported but outdated. Current version is ${CURRENT_SCHEMA_VERSION}.`,
      severity: 'info',
    });
  }

  // Build ID maps for reference checking
  const stakeholderIds = new Set(model.stakeholders.map((s) => s.id));
  const securityClassIds = new Set(model.securityClasses.map((sc) => sc.id));

  // Check for duplicate IDs
  const allIds = [
    ...model.stakeholders.map((s) => s.id),
    ...model.securityClasses.map((sc) => sc.id),
    ...model.issuances.map((i) => i.id),
    ...model.optionGrants.map((og) => og.id),
    ...model.safes.map((s) => s.id),
    ...model.valuations.map((v) => v.id),
  ];
  const idCounts = new Map<string, number>();
  for (const id of allIds) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push(`Duplicate ID found: ${id} appears ${count} times`);
    }
  }

  // Validate issuance references
  model.issuances.forEach((issuance, idx) => {
    if (!stakeholderIds.has(issuance.stakeholderId)) {
      errors.push(`issuances[${idx}]: Invalid stakeholderId reference: ${issuance.stakeholderId}`);
    }
    if (!securityClassIds.has(issuance.securityClassId)) {
      errors.push(
        `issuances[${idx}]: Invalid securityClassId reference: ${issuance.securityClassId}`
      );
    }
  });

  // Validate option grant references
  model.optionGrants.forEach((grant, idx) => {
    if (!stakeholderIds.has(grant.stakeholderId)) {
      errors.push(`optionGrants[${idx}]: Invalid stakeholderId reference: ${grant.stakeholderId}`);
    }

    // Validate vesting dates
    if (grant.vesting) {
      const vestingStart = new Date(grant.vesting.start);
      const grantDate = new Date(grant.grantDate);
      if (vestingStart < grantDate) {
        warnings.push({
          path: `optionGrants[${idx}].vesting.start`,
          message: 'Vesting start date is before grant date',
          severity: 'warning',
        });
      }
    }
  });

  // Validate SAFE references
  model.safes.forEach((safe, idx) => {
    if (!stakeholderIds.has(safe.stakeholderId)) {
      errors.push(`safes[${idx}]: Invalid stakeholderId reference: ${safe.stakeholderId}`);
    }

    // Business rule: SAFE should have either cap or discount
    if (!safe.cap && !safe.discount) {
      warnings.push({
        path: `safes[${idx}]`,
        message: 'SAFE has neither cap nor discount specified',
        severity: 'warning',
      });
    }
  });

  // Check total issued shares vs authorized
  const issuedByClass = new Map<string, number>();
  model.issuances.forEach((issuance) => {
    const current = issuedByClass.get(issuance.securityClassId) || 0;
    issuedByClass.set(issuance.securityClassId, current + issuance.qty);
  });

  model.securityClasses.forEach((sc) => {
    if (sc.kind !== 'OPTION_POOL') {
      const issued = issuedByClass.get(sc.id) || 0;
      if (issued > sc.authorized) {
        errors.push(
          `Security class ${sc.label}: Issued shares (${issued}) exceed authorized (${sc.authorized})`
        );
      }
    }
  });

  // Check option pool usage
  const optionPools = model.securityClasses.filter((sc) => sc.kind === 'OPTION_POOL');
  const totalGranted = model.optionGrants.reduce((sum, grant) => sum + grant.qty, 0);
  const totalPoolAuthorized = optionPools.reduce((sum, pool) => sum + pool.authorized, 0);

  if (totalGranted > totalPoolAuthorized) {
    errors.push(
      `Total option grants (${totalGranted}) exceed option pool authorized (${totalPoolAuthorized})`
    );
  }

  // Check for orphaned stakeholders (no equity)
  const stakeholdersWithEquity = new Set([
    ...model.issuances.map((i) => i.stakeholderId),
    ...model.optionGrants.map((og) => og.stakeholderId),
    ...model.safes.map((s) => s.stakeholderId),
  ]);

  model.stakeholders.forEach((stakeholder) => {
    if (!stakeholdersWithEquity.has(stakeholder.id)) {
      warnings.push({
        path: `stakeholder.${stakeholder.id}`,
        message: `Stakeholder "${stakeholder.name}" has no equity`,
        severity: 'info',
      });
    }
  });

  // Validate dates are chronological
  if (model.company.formationDate) {
    const formationDate = new Date(model.company.formationDate);

    model.issuances.forEach((issuance, idx) => {
      if (new Date(issuance.date) < formationDate) {
        warnings.push({
          path: `issuances[${idx}].date`,
          message: 'Issuance date is before company formation date',
          severity: 'warning',
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
