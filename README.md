# 🧭 Captan  
**Command your ownership.**  
Open Source Cap Table Management CLI

[![npm version](https://img.shields.io/npm/v/captan.svg?color=blue&logo=npm)](https://www.npmjs.com/package/captan)
[![Downloads](https://img.shields.io/npm/dm/captan.svg?color=green)](https://www.npmjs.com/package/captan)
[![Build Status](https://github.com/<your-org>/captan/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-org>/captan/actions)
[![Coverage Status](https://coveralls.io/repos/github/<your-org>/captan/badge.svg?branch=main)](https://coveralls.io/github/<your-org>/captan?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Overview
Captan is a lightweight, hackable CLI tool for managing startup **cap tables**.  
Keep ownership records simple and transparent with a single JSON file (`captable.json`).  

- 🪶 Zero database required — just git & JSON  
- 📊 Real cap table math: outstanding vs fully diluted  
- ⏳ Simple vesting schedules with cliffs  
- 📜 Audit log for every action  
- 📤 Export to CSV/JSON for investors & lawyers  

---

## 🚀 QuickStart

### Install
Use npx (no install):
```bash
npx captan@latest --help
```

Or install globally:
```bash
npm install -g captan
captan --help
```

> Requires Node.js 18+

### One-minute flow

```bash
# 1. Init a new cap table
captan init --name "Acme, Inc." --pool 2000000

# 2. Add stakeholders
captan enlist stakeholder --name "Alice Founder" --email alice@acme.com
captan enlist stakeholder --name "Bob Eng"

# 3. Issue shares
captan issue --security sc_common --holder sh_alice --qty 5000000 --pps 0.0001 --date 2024-01-02

# 4. Grant options
captan grant --holder sh_bob --qty 200000 --exercise 0.10 --grant-date 2024-04-01 --start 2024-04-01

# 5. View your cap table
captan chart --date 2025-08-16
```

### 📊 Sample Output
```yaml
📊 Captan — Cap Table (as of 2025-08-16)
Name                      Outstanding    %
Alice Founder                  5000000   96.15%
Bob Eng                          80000    1.54%

Totals
Issued equity:       5000000
Vested options:      80000
Outstanding total:   5080000
FD issued:           5000000
FD grants:           200000
FD pool remaining:   1800000
Fully diluted total: 7000000
```

## 🧩 Features

- **Stakeholder management**
- **Security classes** (common, preferred, option pools)
- **Share issuances**
- **Option grants & vesting schedules**
- **Cap table reports** (outstanding & FD)
- **Export CSV/JSON**
- **Audit history** (the "ship's log")

## 📖 Commands

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

## 🛠️ Development

```bash
git clone https://github.com/<your-org>/captan
cd captan
yarn install
yarn build
node dist/cli.js --help
```

Run in dev mode:
```bash
yarn dev init --name "DemoCo"
```

Run tests:
```bash
yarn test
yarn test:coverage
```

## 🤝 Contributing

Pull requests are welcome! Please open an issue first for major changes.
For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon).

## 📜 License

MIT © 2025 Captan Contributors

## ⚠️ Disclaimer

Captan is **not** legal advice. Always verify calculations and consult professionals before sending cap tables to investors or making equity decisions.

## 🌐 Links

- [npm package](https://www.npmjs.com/package/captan)
- [GitHub Issues](https://github.com/<your-org>/captan/issues)
- [Changelog](CHANGELOG.md)