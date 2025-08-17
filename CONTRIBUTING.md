# Contributing to Captan

First off, thank you for considering contributing to Captan! 🧭

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and considerate in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your feature or bugfix
4. **Make your changes** with tests
5. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ 
- Yarn package manager
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/captan.git
cd captan

# Install dependencies
yarn install

# Run tests to verify setup
yarn test

# Build the project
yarn build
```

### Development Workflow

```bash
# Run in development mode
yarn dev init --name "TestCo"

# Run tests in watch mode
yarn test:watch

# Check types
yarn validate:fix

# Run full test suite
yarn test:all
```

## Project Structure

```
captan/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── model.ts               # Data models and calculations
│   ├── store.ts               # File persistence
│   ├── branding.ts            # App constants
│   └── services/              # Business logic
│       ├── stakeholder-service.ts
│       ├── security-service.ts
│       ├── equity-service.ts
│       ├── reporting-service.ts
│       └── audit-service.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Making Changes

### Adding a New Feature

1. **Open an issue** first to discuss the feature
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Write tests first** (TDD approach recommended)
4. **Implement the feature** in the appropriate service
5. **Update CLI** if adding new commands
6. **Add documentation** in README if needed

### Fixing a Bug

1. **Create a test** that reproduces the bug
2. **Fix the bug** ensuring all tests pass
3. **Add regression test** to prevent future issues

### Example: Adding a New Command

```typescript
// In cli.ts
program
  .command('your-command')
  .description('Description of your command')
  .option('-o, --option <value>', 'option description')
  .action((opts) => {
    const model = load();
    const service = new YourService(model);
    
    try {
      // Your logic here
      save(model);
      console.log('✅ Success message');
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });
```

## Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run with coverage
yarn test:coverage

# Run specific test file
yarn test src/model.test.ts
```

### Writing Tests

Tests are colocated with source files:
- `model.ts` → `model.test.ts`
- `services/equity-service.ts` → `services/equity-service.test.ts`

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { YourService } from './your-service.js';

describe('YourService', () => {
  it('should do something', () => {
    const service = new YourService(mockModel);
    const result = service.doSomething();
    expect(result).toBe(expectedValue);
  });
});
```

### Test Coverage

We aim for:
- **95%+** coverage for services (business logic)
- **100%** coverage for model calculations
- **80%+** coverage for CLI commands

## Submitting Changes

### Pull Request Process

1. **Update tests** - Ensure all tests pass
2. **Update documentation** - Keep README current
3. **Write clear commit messages**:
   ```
   feat: Add support for SAFE instruments
   
   - Add SAFE as new security type
   - Implement conversion calculations
   - Update reporting to include SAFEs
   ```
4. **Submit PR** with:
   - Clear description of changes
   - Link to related issue
   - Screenshots if UI changes

### Commit Message Format

We follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over type aliases for objects
- Use Zod schemas for runtime validation
- Export types from model.ts

### Code Style

```typescript
// ✅ Good
export class StakeholderService {
  constructor(private model: FileModel) {}
  
  addStakeholder(name: string, type: 'person' | 'entity'): Stakeholder {
    // Implementation
  }
}

// ❌ Avoid
export class stakeholder_service {
  model: any;
  
  add(n, t) {
    // Implementation
  }
}
```

### File Naming

- Services: `kebab-case.ts` (e.g., `equity-service.ts`)
- Tests: `*.test.ts` colocated with source
- Classes: `PascalCase` (e.g., `EquityService`)

### Error Handling

Always throw descriptive errors:

```typescript
if (!stakeholder) {
  throw new Error(`Stakeholder with ID "${id}" not found`);
}
```

## Reporting Issues

### Bug Reports

Please include:
1. **Description** of the issue
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **System information** (Node version, OS)
6. **Error messages** if any

### Feature Requests

Please include:
1. **Use case** - Why is this needed?
2. **Proposed solution**
3. **Alternatives considered**
4. **Additional context**

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion in GitHub Discussions
- Reach out to maintainers

## Recognition

Contributors will be recognized in:
- The README contributors section
- Release notes
- The AUTHORS file (for significant contributions)

Thank you for helping make Captan better! 🚀