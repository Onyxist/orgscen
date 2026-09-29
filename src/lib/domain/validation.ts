import type { Person } from './model';

export interface ValidationIssue {
  level: 'error' | 'warning';
  personId?: string;
  message: string;
}

const EPSILON = 0.01;

export function validatePeople(people: Person[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();

  for (const person of people) {
    if (!person.id.trim()) {
      issues.push({ level: 'error', message: 'A person is missing an ID.' });
      continue;
    }
    if (ids.has(person.id)) {
      issues.push({ level: 'error', personId: person.id, message: `Duplicate ID: ${person.id}.` });
    }
    ids.add(person.id);
  }

  const byId = new Map(people.map((person) => [person.id, person]));
  for (const person of people) {
    if (person.managerId === person.id) {
      issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id} cannot report to themselves.` });
    } else if (person.managerId && !byId.has(person.managerId)) {
      issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id}: manager ${person.managerId} does not exist.` });
    }

    if (person.costAllocations.length) {
      const total = person.costAllocations.reduce((sum, allocation) => sum + allocation.percent, 0);
      if (Math.abs(total - 100) > EPSILON) {
        issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id}: salary allocation totals ${formatPercent(total)}, not 100%.` });
      }
      const seen = new Set<string>();
      for (const allocation of person.costAllocations) {
        const key = allocation.costCenter.trim();
        if (!key) issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id}: a cost allocation is missing its cost center.` });
        if (allocation.percent <= 0) issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id}: allocation percentages must be greater than zero.` });
        if (seen.has(key) && key) issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id}: cost center ${key} appears more than once in salary allocation.` });
        if (key) seen.add(key);
      }
    }

    if (person.status === 'active' && person.managerId) {
      const manager = byId.get(person.managerId);
      if (manager?.status === 'parked') {
        issues.push({ level: 'warning', personId: person.id, message: `${person.name || person.id} reports to parked person ${manager.name || manager.id}; they will appear as a visual root until reassigned.` });
      }
    }
  }

  for (const person of people) {
    const visited = new Set<string>([person.id]);
    let cursor: Person | undefined = person;
    while (cursor?.managerId) {
      if (visited.has(cursor.managerId)) {
        issues.push({ level: 'error', personId: person.id, message: `${person.name || person.id}: reporting line contains a cycle.` });
        break;
      }
      visited.add(cursor.managerId);
      cursor = byId.get(cursor.managerId);
    }
  }

  return dedupe(issues);
}

export function wouldCreateCycle(people: Person[], personId: string, managerId: string | null): boolean {
  if (!managerId) return false;
  if (managerId === personId) return true;
  const byId = new Map(people.map((person) => [person.id, person]));
  let cursor = byId.get(managerId);
  while (cursor) {
    if (cursor.id === personId) return true;
    cursor = cursor.managerId ? byId.get(cursor.managerId) : undefined;
  }
  return false;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value) + '%';
}

function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.level}|${issue.personId ?? ''}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
