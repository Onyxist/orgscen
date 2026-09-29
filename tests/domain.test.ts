import { describe, expect, it } from 'vitest';
import { createBaseline, createScenario, type Person } from '../src/lib/domain/model';
import { costCenterSummary } from '../src/lib/domain/metrics';
import { buildVisualForest } from '../src/lib/org/layout';
import { validatePeople } from '../src/lib/domain/validation';

const person = (overrides: Partial<Person> = {}): Person => ({
  headcount: 1,
  id: '1',
  name: 'Alex Example',
  title: 'CEO',
  department: 'Executive',
  workTimePct: 100,
  salary: 6000,
  socialCostPct: 25,
  managerId: null,
  comment: '',
  primaryCostCenter: 'CC100',
  costAllocations: [],
  status: 'active',
  startsNewTree: false,
  origin: 'imported',
  ...overrides
});

describe('cost-centre accounting', () => {
  it('keeps all FTE in the primary cost centre while splitting salary and employer cost', () => {
    const rows = costCenterSummary([
      person({ costAllocations: [{ costCenter: 'CC100', percent: 70 }, { costCenter: 'CC200', percent: 30 }] })
    ], 'active');
    const primary = rows.find((row) => row.key === 'CC100')!;
    const secondary = rows.find((row) => row.key === 'CC200')!;

    expect(primary.fte).toBe(1);
    expect(secondary.fte).toBe(0);
    expect(primary.salary).toBe(4200);
    expect(secondary.salary).toBe(1800);
    expect(primary.totalCost).toBe(5250);
    expect(secondary.totalCost).toBe(2250);
  });
});

describe('scenario branching', () => {
  it('creates an independent snapshot', () => {
    const project = createBaseline([person()]);
    const scenarioA = createScenario(project, 'A', project.currentScenarioId);
    project.scenarios.push(scenarioA);
    scenarioA.people[0].salary = 7000;

    const scenarioB = createScenario(project, 'B', scenarioA.id);
    project.scenarios.push(scenarioB);
    scenarioA.people[0].salary = 8000;

    expect(scenarioB.people[0].salary).toBe(7000);
    expect(scenarioB.baseSnapshot[0].salary).toBe(7000);
  });
});

describe('visual tree breaks', () => {
  it('keeps the real manager but starts a new visual root', () => {
    const people = [
      person({ id: 'ceo' }),
      person({ id: 'cfo', name: 'CFO', managerId: 'ceo', startsNewTree: true })
    ];
    const forest = buildVisualForest(people);
    expect(people[1].managerId).toBe('ceo');
    expect(forest.roots.map((item) => item.id)).toContain('cfo');
    expect(forest.parentById.get('cfo')).toBeNull();
  });
});

describe('parked population', () => {
  it('warns when an active person reports to a parked manager', () => {
    const people = [
      person({ id: 'mgr', status: 'parked' }),
      person({ id: 'emp', name: 'Employee', managerId: 'mgr' })
    ];
    const warnings = validatePeople(people).filter((issue) => issue.level === 'warning');
    expect(warnings.some((issue) => issue.message.includes('reports to parked person'))).toBe(true);
  });
});
