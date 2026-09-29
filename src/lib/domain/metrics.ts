import type { CostAllocation, Person, PersonStatus } from './model';

export interface Totals {
  headcount: number;
  fte: number;
  weeklyHours: number;
  salary: number;
  socialCost: number;
  totalCost: number;
  annualCost: number;
}

export interface SummaryRow extends Totals {
  key: string;
  averageSalary: number;
}

export interface CostCenterRow extends Totals {
  key: string;
}

export type Population = PersonStatus | 'combined';

export function personFte(person: Person): number {
  return person.workTimePct / 100;
}

export function personSocialCost(person: Person): number {
  return person.salary * (person.socialCostPct / 100);
}

export function personTotalCost(person: Person): number {
  return person.salary + personSocialCost(person);
}

export function effectiveAllocations(person: Person): CostAllocation[] {
  if (person.costAllocations.length) return person.costAllocations;
  return [{ costCenter: person.primaryCostCenter.trim() || '(Unassigned)', percent: 100 }];
}

function include(person: Person, population: Population): boolean {
  return population === 'combined' || person.status === population;
}

export function calculateTotals(people: Person[], population: Population): Totals {
  const result = emptyTotals();
  for (const person of people) {
    if (!include(person, population)) continue;
    result.headcount += person.headcount;
    result.fte += personFte(person);
    result.weeklyHours += 37.5 * personFte(person);
    result.salary += person.salary;
    result.socialCost += personSocialCost(person);
    result.totalCost += personTotalCost(person);
  }
  result.annualCost = result.totalCost * 12;
  return result;
}

export function departmentSummary(people: Person[], population: Population): SummaryRow[] {
  const rows = new Map<string, SummaryRow>();
  for (const person of people) {
    if (!include(person, population)) continue;
    const key = person.department.trim() || '(No department)';
    const row = rows.get(key) ?? { key, ...emptyTotals(), averageSalary: 0 };
    row.headcount += person.headcount;
    row.fte += personFte(person);
    row.weeklyHours += 37.5 * personFte(person);
    row.salary += person.salary;
    row.socialCost += personSocialCost(person);
    row.totalCost += personTotalCost(person);
    rows.set(key, row);
  }

  for (const row of rows.values()) {
    row.annualCost = row.totalCost * 12;
    row.averageSalary = row.headcount ? row.salary / row.headcount : 0;
  }

  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function costCenterSummary(people: Person[], population: Population): CostCenterRow[] {
  const rows = new Map<string, CostCenterRow>();
  const ensure = (key: string): CostCenterRow => {
    const normalized = key.trim() || '(Unassigned)';
    const row = rows.get(normalized) ?? { key: normalized, ...emptyTotals() };
    rows.set(normalized, row);
    return row;
  };

  for (const person of people) {
    if (!include(person, population)) continue;

    // Headcount and FTE belong entirely to the primary cost centre.
    const primary = ensure(person.primaryCostCenter);
    primary.headcount += person.headcount;
    primary.fte += personFte(person);
    primary.weeklyHours += 37.5 * personFte(person);

    const social = personSocialCost(person);
    const total = personTotalCost(person);
    for (const allocation of effectiveAllocations(person)) {
      const share = allocation.percent / 100;
      const row = ensure(allocation.costCenter);
      row.salary += person.salary * share;
      row.socialCost += social * share;
      row.totalCost += total * share;
    }
  }

  for (const row of rows.values()) row.annualCost = row.totalCost * 12;
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function emptyTotals(): Totals {
  return {
    headcount: 0,
    fte: 0,
    weeklyHours: 0,
    salary: 0,
    socialCost: 0,
    totalCost: 0,
    annualCost: 0
  };
}
