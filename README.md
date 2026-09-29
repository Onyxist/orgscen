# OrgScenario

A local-first organization and workforce scenario modeler.

Very niche. Built because I needed it. Maybe someone else does too.

Import an organization, create a scenario, move people around, park roles, split costs, compare structures and print the result.

No account.  
No application backend.  
No database.

OrgScenario runs in the browser. Imported employee data is not sent to an OrgScenario server.

## What it does

- Opens an organization from CSV
- Branches a new scenario from the currently opened scenario
- Lets you drag and drop reporting lines and edit employee information
- Starts a separate visual tree without changing the actual manager relationship
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
CC100:70|CC200:30```

## RUN LOCALLY

Requires Node.js 22.12+

npm install
npm run dev

## CHECKS

npm run check
npm test
npm run build

## STATUS

Early preview.
It works. It is also still being built (maybe).