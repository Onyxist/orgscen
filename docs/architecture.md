# Architecture and domain invariants

OrgScenario keeps domain rules separate from Svelte rendering.

The UI can change. These rules should not.

## 1. Reporting, department, and costing are separate dimensions

A person has:

- a reporting manager (`managerId`)
- a department (`department`)
- a primary cost center (`primaryCostCenter`)
- zero or more salary allocations (`costAllocations`)

Changing one does not implicitly change the others.

## 2. FTE belongs to the primary cost center

Headcount, FTE, and weekly hours are attributed 100% to the person's primary cost center.

Salary and employer costs may be split between cost centers.

For example:

```text
Primary cost center: CC100
FTE: 1.00
Salary: 6,000
Salary allocation: CC100 70%, CC200 30%
```

produces:

```text
CC100: 1.00 FTE, 4,200 salary
CC200: 0.00 FTE, 1,800 salary
```

Employer costs use the same split as salary.

## 3. A visual tree break is not an organizational change

`startsNewTree = true` suppresses the visual connection to the manager.

This allows a chart such as:

```text
CEO

CFO tree     COO tree     CHRO tree
```

while CFO, COO, and CHRO still formally report to the CEO.

## 4. Parked = population state

A parked person:

- remains in the scenario dataset
- is removed from the active org chart
- appears in a separate Parked bin
- is excluded from Active totals
- is included in Parked and Combined totals

Deleting a person is a separate operation.

If an active person reports to a parked manager, validation warns about it and the active person becomes a visual root until reassigned.

## 5. Scenario branching uses snapshots

Creating scenario B based on scenario A copies A at that moment.

Later edits to A must not mutate B.

Each non-baseline scenario therefore stores:

- `basedOnScenarioId`
- `basedOnScenarioName`
- `baseSnapshot`
- its mutable `people` state

Reset restores `baseSnapshot`, not the current state of the source scenario.

## 6. Current organization is read-only

The baseline exists for comparison and cannot be edited in the UI.

Users create a scenario before changing people, reporting lines, or costs.

## 7. JSON is the lossless project format

The JSON project format is authoritative for complete save/restore because it preserves scenario reset snapshots and lineage.

CSV is an interchange format intended for humans and existing spreadsheet workflows.

It preserves scenario state, parked status, cost allocation, and visual breaks, but cannot perfectly encode every historical snapshot relationship.

## 8. Printing is a document renderer

Printing does not print the application UI.

`PrintReport.svelte` builds a separate document-oriented representation for A4 landscape output.

This separation should remain even if the interactive chart is redesigned.
