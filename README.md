# Captan

**Command your ownership.** A tiny, hackable CLI cap table tool backed by a single `captable.json`.

## Install / Run

Use **npx** (no install):
```bash
npx captan@latest --help
```

Or install globally:
```bash
npm install -g captan
captan --help
```

> Requires Node.js 18+

## One-minute QuickStart

1. Initialize a new cap table:
```bash
captan init --name "Acme, Inc." --pool 2000000
```

2. Add stakeholders:
```bash
captan enlist stakeholder --name "Alice Founder" --email alice@acme.com
captan enlist stakeholder --name "Bob Engineer" --email bob@acme.com
```

3. (Optional) Add a preferred class:
```bash
captan security:add --kind PREF --label "Series Seed" --authorized 5000000
```

4. Issue common shares:
```bash
# List stakeholders to get IDs
captan list stakeholders

# Issue shares (replace sh_... with actual ID)
captan issue --security sc_common --holder sh_alice --qty 5000000 --pps 0.0001 --date 2024-01-02
```

5. Grant options with vesting:
```bash
captan grant --holder sh_bob --qty 200000 --exercise 0.10 \
  --grant-date 2024-04-01 --start 2024-04-01 --months 48 --cliff 12
```

6. See your cap table:
```bash
captan chart --date 2025-08-16
```

7. Export data:
```bash
captan export json > captable-backup.json
captan export csv > captable.csv
```

8. View audit trail:
```bash
captan log
```

## Commands

### Core Commands
- `captan init` - Initialize a new cap table
- `captan enlist stakeholder` - Add a stakeholder (person or entity)
- `captan security:add` - Add a security class (COMMON, PREF, or OPTION_POOL)
- `captan issue` - Issue shares to a stakeholder
- `captan grant` - Grant options with vesting schedules

### Reporting Commands
- `captan chart` - Display cap table with ownership percentages
- `captan report stakeholder <id>` - Show stakeholder's holdings
- `captan report security <id>` - Show security class utilization
- `captan report summary` - Full cap table summary
- `captan list stakeholders` - List all stakeholders
- `captan list securities` - List all security classes

### Data Commands
- `captan export json` - Export complete data as JSON
- `captan export csv` - Export holdings as CSV
- `captan log` - View audit trail

## Concepts

### Outstanding vs Fully Diluted
- **Outstanding** = issued equity (common + preferred) + **vested** options
- **Fully diluted** = issued equity + **all granted options** + **remaining option pool**

### Vesting
Options vest monthly with cliff periods:
- Standard: 4 years (48 months) with 1-year cliff
- Options don't count as outstanding until vested
- Full grant counts toward fully diluted from day one

### Data Storage
All data lives in `captable.json` in your current directory:
- Version control friendly (commit it!)
- Human-readable JSON format
- Complete audit trail included
- Works great alongside company docs in a repo

## Advanced Usage

### Custom Vesting Schedules
```bash
# 3-year vest, 6-month cliff
captan grant --holder sh_alice --qty 100000 --exercise 0.25 \
  --months 36 --cliff 6

# Immediate vesting (no schedule)
captan grant --holder sh_bob --qty 50000 --exercise 0.10 --no-vesting
```

### Multiple Security Classes
```bash
# Add Series A Preferred
captan security:add --kind PREF --label "Series A" --authorized 3000000 --par 0.001

# Issue preferred shares
captan issue --security sc_xyz --holder sh_investor --qty 2000000 --pps 2.00
```

### Detailed Reports
```bash
# JSON format for cap table (for integrations)
captan chart --format json

# Filter audit log
captan log --action ISSUE --limit 10

# Stakeholder detail report
captan report stakeholder sh_alice
```

## Architecture

Captan uses a service-oriented architecture:
- **Services**: Business logic (stakeholder, security, equity, reporting, audit)
- **Model**: Data types and calculations (Zod validated)
- **Store**: File persistence layer
- **CLI**: Thin command interface

## Development

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Build for production
yarn build

# Development mode
yarn dev <command>
```

## License

MIT License - see LICENSE file for details.

## Notes

Captan is **not** legal advice. Always verify calculations and consult professionals before sending cap tables to investors or making equity decisions.