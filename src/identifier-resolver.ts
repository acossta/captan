/**
 * Identifier Resolution System
 *
 * Provides utilities to resolve stakeholder identifiers that can be either:
 * - A prefixed ID (e.g., "sh_alice")
 * - An email address (e.g., "alice@example.com")
 *
 * This allows users to reference stakeholders using whichever identifier
 * is more convenient for their workflow.
 */

import { Stakeholder } from './model.js';
import { load } from './store.js';

export interface ResolverResult {
  success: boolean;
  stakeholder?: Stakeholder;
  error?: string;
}

/**
 * Determines if a string is likely an email address
 */
export function isEmail(identifier: string): boolean {
  // Basic email pattern check
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(identifier);
}

/**
 * Determines if a string is a prefixed ID
 */
export function isPrefixedId(identifier: string): boolean {
  // Check for pattern: prefix_identifier
  const idPattern = /^[a-z]+_[a-zA-Z0-9-]+$/;
  return idPattern.test(identifier);
}

/**
 * Resolves a stakeholder identifier (ID or email) to a Stakeholder object
 */
export function resolveStakeholder(identifier: string | undefined): ResolverResult {
  if (!identifier) {
    return {
      success: false,
      error: 'No identifier provided',
    };
  }

  const captable = load('captable.json');
  if (!captable) {
    return {
      success: false,
      error: 'No captable.json found',
    };
  }

  // Determine lookup method based on identifier format
  let stakeholder: Stakeholder | undefined;

  if (isEmail(identifier)) {
    // Lookup by email
    stakeholder = captable.stakeholders.find((sh) => sh.email === identifier);

    if (!stakeholder) {
      return {
        success: false,
        error: `No stakeholder found with email: ${identifier}`,
      };
    }
  } else if (isPrefixedId(identifier)) {
    // Lookup by ID
    stakeholder = captable.stakeholders.find((sh) => sh.id === identifier);

    if (!stakeholder) {
      return {
        success: false,
        error: `No stakeholder found with ID: ${identifier}`,
      };
    }
  } else {
    // Try both methods as fallback
    stakeholder = captable.stakeholders.find(
      (sh) => sh.id === identifier || sh.email === identifier
    );

    if (!stakeholder) {
      return {
        success: false,
        error: `No stakeholder found with identifier: ${identifier}`,
      };
    }
  }

  return {
    success: true,
    stakeholder,
  };
}

/**
 * Resolves multiple stakeholder identifiers
 */
export function resolveStakeholders(identifiers: string[]): {
  success: boolean;
  stakeholders: Stakeholder[];
  errors: string[];
} {
  const stakeholders: Stakeholder[] = [];
  const errors: string[] = [];

  for (const identifier of identifiers) {
    const result = resolveStakeholder(identifier);
    if (result.success && result.stakeholder) {
      stakeholders.push(result.stakeholder);
    } else {
      errors.push(result.error || `Failed to resolve: ${identifier}`);
    }
  }

  return {
    success: errors.length === 0,
    stakeholders,
    errors,
  };
}

/**
 * Gets a display name for a stakeholder identifier
 * This is useful for error messages and confirmations
 */
export function getIdentifierDisplay(identifier: string): string {
  if (isEmail(identifier)) {
    return `email '${identifier}'`;
  } else if (isPrefixedId(identifier)) {
    return `ID '${identifier}'`;
  } else {
    return `'${identifier}'`;
  }
}

/**
 * Validates that an identifier can be used for stakeholder lookup
 */
export function validateIdentifier(identifier: string): {
  valid: boolean;
  type?: 'email' | 'id';
  error?: string;
} {
  if (!identifier || identifier.trim() === '') {
    return {
      valid: false,
      error: 'Identifier cannot be empty',
    };
  }

  if (isEmail(identifier)) {
    return {
      valid: true,
      type: 'email',
    };
  }

  if (isPrefixedId(identifier)) {
    return {
      valid: true,
      type: 'id',
    };
  }

  // Could still be valid, just not a standard format
  return {
    valid: true,
    type: undefined,
  };
}

/**
 * Suggests similar stakeholders when resolution fails
 * Useful for providing helpful error messages
 */
export function suggestSimilarStakeholders(identifier: string, limit: number = 3): Stakeholder[] {
  const captable = load('captable.json');
  if (!captable) {
    return [];
  }

  const lowerIdentifier = identifier.toLowerCase();

  // Score each stakeholder based on similarity
  const scored = captable.stakeholders.map((sh) => {
    let score = 0;

    // Check ID similarity
    if (sh.id.toLowerCase().includes(lowerIdentifier)) {
      score += 2;
    }

    // Check email similarity
    if (sh.email && sh.email.toLowerCase().includes(lowerIdentifier)) {
      score += 2;
    }

    // Check name similarity
    if (sh.name.toLowerCase().includes(lowerIdentifier)) {
      score += 1;
    }

    return { stakeholder: sh, score };
  });

  // Sort by score and return top matches
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.stakeholder);
}

/**
 * Formats a stakeholder for display with both ID and email
 */
export function formatStakeholderReference(stakeholder: Stakeholder): string {
  if (stakeholder.email) {
    return `${stakeholder.name} (${stakeholder.id}, ${stakeholder.email})`;
  } else {
    return `${stakeholder.name} (${stakeholder.id})`;
  }
}
