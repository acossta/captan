# Changelog

All notable changes to Captan will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-08-19

### Added
- Comprehensive JSON schema validation with Zod
- Custom format validators for dates, UUIDs, emails, currency codes, and percentages
- Extended validation with business rules and cross-entity checks
- Warning system for non-critical issues (orphaned stakeholders, SAFEs without terms, etc.)
- JSON Schema generation via `captan schema` command
- Schema validation commands: `captan validate` and `captan validate --extended`
- Automatic schema file generation on `captan init` for IDE support
- 45 new tests covering schema validation, error messages, and integration scenarios

### Changed
- Updated Zod dependency to ^3.24.1 for compatibility with zod-to-json-schema
- Enhanced README with comprehensive JSON Schema & Validation documentation

### Fixed
- Entity type validation for SAFEs and option pools (preventing invalid entity combinations)

## [0.3.0] - 2025-08-19

### Added
- Dry-run option (`--dry-run`) for SAFE conversion to preview changes without executing
- Ownership percentage calculations in SAFE conversion preview
- Comprehensive unit tests for CLI handlers (coverage improved from 58% to 78%+)
- Test output folder to .gitignore
- Ship's wheel emoji (⎈) as new branding logo

### Changed
- Refactored CLI architecture to extract business logic into testable handlers
- Improved release workflow documentation with changelog update steps

### Fixed
- SAFE discount calculation (20% discount now correctly applies as 0.8 multiplier)
- CLI command structure to match README documentation (`captan enlist stakeholder` instead of `captan stakeholder`)
- Missing `--action` parameter in log command
- All CLI commands now properly aligned with README specifications

## [0.2.2] - 2025-08-18

### Fixed
- CI/CD workflow issues for npm publishing
- Coverage upload made non-blocking in CI

### Changed
- Improved release workflow documentation

## [0.2.1] - 2025-08-17

### Fixed
- npm publishing workflow configuration

## [0.2.0] - 2025-08-17

### Added
- GitHub Actions CI/CD workflow
- Automated npm publishing on release
- Test coverage reporting with Coveralls

## [0.1.0] - 2025-08-17

### Added
- Initial release of Captan CLI cap table management tool
- Core cap table functionality:
  - Stakeholder management (persons and entities)
  - Security classes (Common, Preferred, Option Pool)
  - Share issuances with certificate tracking
  - Option grants with vesting schedules (cliff and monthly vesting)
- SAFE (Simple Agreement for Future Equity) support:
  - Add SAFEs with cap, discount, and type (pre/post money)
  - List all outstanding SAFEs
  - Simulate SAFE conversion at priced rounds
  - Integration with cap table reporting
- Entity type support (C-Corp, S-Corp, LLC) with appropriate terminology
- Interactive wizard mode for company initialization
- Founder equity issuance at initialization
- Comprehensive reporting:
  - Cap table with outstanding and fully diluted calculations
  - Stakeholder-specific reports
  - Security class utilization reports
  - CSV and JSON export capabilities
- Audit trail for all actions
- TypeScript with full type safety
- Comprehensive test suite (188 tests)
- ESLint and Prettier configuration

### Technical Details
- Built with TypeScript and ES modules
- Service-oriented architecture
- Commander.js for CLI interface
- Zod for runtime validation
- Vitest for testing
- Single JSON file storage (captable.json)
- Zero database required

[0.3.1]: https://github.com/acossta/captan/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/acossta/captan/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/acossta/captan/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/acossta/captan/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/acossta/captan/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/acossta/captan/releases/tag/v0.1.0