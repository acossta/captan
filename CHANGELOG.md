# Changelog

All notable changes to Captan will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/acossta/captan/releases/tag/v0.1.0