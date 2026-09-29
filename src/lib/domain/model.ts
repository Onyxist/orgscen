export type PersonStatus = 'active' | 'parked';

export interface CostAllocation {
  costCenter: string;
  percent: number;
}

export interface Person {
  headcount: number;
  id: string;
  name: string;
  title: string;
  department: string;
  workTimePct: number;
  salary: number;
  socialCostPct: number;
  managerId: string | null;
  comment: string;
  primaryCostCenter: string;
  costAllocations: CostAllocation[];
  status: PersonStatus;
  startsNewTree: boolean;
  origin: 'imported' | 'new';
}

export interface Scenario {
  id: string;
  name: string;
  isBaseline: boolean;
  basedOnScenarioId: string | null;
  basedOnScenarioName: string | null;
  createdAt: string;
  people: Person[];
  baseSnapshot: Person[];
}

export interface Project {
  format: 'orgscenario';
  version: 1;
  currentScenarioId: string;
  scenarios: Scenario[];
}

export const BASELINE_ID = 'current';

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function scenarioById(project: Project, scenarioId: string): Scenario {
  const scenario = project.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  return scenario;
}

export function currentScenario(project: Project): Scenario {
  return scenarioById(project, project.currentScenarioId);
}

export function createBaseline(people: Person[]): Project {
  const baseline: Scenario = {
    id: BASELINE_ID,
    name: 'Current organisation',
    isBaseline: true,
    basedOnScenarioId: null,
    basedOnScenarioName: null,
    createdAt: new Date().toISOString(),
    people: deepClone(people),
    baseSnapshot: deepClone(people)
  };

  return {
    format: 'orgscenario',
    version: 1,
    currentScenarioId: BASELINE_ID,
    scenarios: [baseline]
  };
}

export function makeScenarioId(name: string, existingIds: Iterable<string>): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'scenario';
  const used = new Set(existingIds);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function createScenario(project: Project, name: string, basedOnScenarioId: string): Scenario {
  const source = scenarioById(project, basedOnScenarioId);
  const snapshot = deepClone(source.people);
  return {
    id: makeScenarioId(name, project.scenarios.map((item) => item.id)),
    name: name.trim(),
    isBaseline: false,
    basedOnScenarioId: source.id,
    basedOnScenarioName: source.name,
    createdAt: new Date().toISOString(),
    people: deepClone(snapshot),
    baseSnapshot: deepClone(snapshot)
  };
}

export function resetScenario(scenario: Scenario): Scenario {
  if (scenario.isBaseline) return scenario;
  return { ...scenario, people: deepClone(scenario.baseSnapshot) };
}

export function defaultPerson(id: string): Person {
  return {
    headcount: 1,
    id,
    name: 'New role',
    title: '',
    department: '',
    workTimePct: 100,
    salary: 0,
    socialCostPct: 0,
    managerId: null,
    comment: '',
    primaryCostCenter: '',
    costAllocations: [],
    status: 'active',
    startsNewTree: false,
    origin: 'new'
  };
}
