# OrgScenario

A local-first organization and workforce scenario modeler.

Very niche. Built because I needed it. Maybe someone else does too.

Import an organization from CSV or start from scratch. Then create a scenario, move people around, park roles, split costs, compare structures, and print the result.

No account.  
No app backend.  
No database.

OrgScenario runs in the browser. Imported employee data is not sent to an OrgScenario server by this app.

## What it does

- Opens an organization from CSV
- Or lets you build one from scratch
- Branches a new scenario from the current organization or another scenario
- Lets you drag and drop reporting lines and edit employee information
- Starts a separate visual tree without changing the real manager relationship
- Parks people outside the active structure and calculates them separately
- Splits salary and employer costs across cost centers
- Keeps headcount and FTE in the primary cost center
- Compares departments and cost centers
- Saves the full project as JSON
- Exports scenarios as CSV
- Prints an organization chart or scenario report

## CSV

The import expects columns in a defined order.
See [`example.csv`](example.csv) for the expected structure and example English column names.

Cost allocations use this format:

```text
CC100:70|CC200:30
```

## Run locally

Requires Node.js 22.12+.

```bash
npm install
npm run dev
```

## Checks

```bash
npm run check
npm test
npm run build
```

## Status

Early preview.
It works. It is also still being built (maybe).
