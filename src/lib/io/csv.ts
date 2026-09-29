import { createBaseline, createScenario, deepClone, type Person, type Project } from '../domain/model';
import { validatePeople } from '../domain/validation';

const CURRENT_ORGANIZATION = 'Current organization';
const BASELINE_ALIASES = [CURRENT_ORGANIZATION, 'Current organisation', 'Nykytila'] as const;

const CORE_COLUMNS = [
  '#',
  'ID',
  'Nimi',
  'Tehtava',
  'Osasto',
  'Työaika %',
  'Kokonaispalkka',
  'sos. kulup.',
  'M_ID',
  'Kommentti'
] as const;

type CoreColumn = (typeof CORE_COLUMNS)[number];
type CoreIndexMap = Record<CoreColumn, number>;

const EXPORT_CORE_HEADERS = [
  'Headcount',
  'ID',
  'Name',
  'Title',
  'Department',
  'Work time %',
  'Salary',
  'Employer cost %',
  'Manager ID',
  'Comment'
] as const;

const OPTIONAL_COLUMNS = {
  scenario: ['Skenaario', 'Scenario'],
  basedOn: ['Perustuu', 'Based on', 'BasedOn'],
  status: ['Tila', 'Status'],
  primaryCostCenter: ['Ensisijainen kustannuspaikka', 'Kustannuspaikka', 'Primary cost centre', 'Primary cost center'],
  allocations: ['Kustannusjako', 'Palkkajako', 'Cost allocations', 'Cost allocation'],
  startsNewTree: ['Uusi puu', 'Aloita uusi puu', 'Start new tree', 'Visual break']
} as const;

const ALIASES: Record<CoreColumn, string[]> = {
  '#': ['#', 'lkm', 'maara', 'määrä', 'henkilomaara', 'henkilömäärä', 'headcount'],
  ID: ['id', 'henkiloid', 'henkilöid'],
  Nimi: ['nimi', 'name'],
  Tehtava: ['tehtava', 'tehtävä', 'rooli', 'role', 'title'],
  Osasto: ['osasto', 'department', 'dept'],
  'Työaika %': ['tyoaika%', 'työaika%', 'tyoaika', 'työaika', 'fte%', 'worktime%'],
  Kokonaispalkka: ['kokonaispalkka', 'palkka', 'salary'],
  'sos. kulup.': ['sos.kulup.', 'sos kulup.', 'soskulup', 'sosiaalikulup', 'sosiaalikulu%', 'sosiaalikulut%', 'socialcost%', 'employercost%', 'employercost'],
  M_ID: ['m_id', 'mid', 'managerid', 'manager', 'esihenkiloid', 'esihenkilöid'],
  Kommentti: ['kommentti', 'comment', 'comments', 'notes']
};

export function parseCsvProject(text: string): Project {
  const rows = splitCsv(text);
  if (!rows.length) throw new Error('CSV is empty.');

  const headers = rows[0].map((value) => value.trim());
  const scenarioIndex = optionalIndex(headers, OPTIONAL_COLUMNS.scenario);
  const basedOnIndex = optionalIndex(headers, OPTIONAL_COLUMNS.basedOn);
  const statusIndex = optionalIndex(headers, OPTIONAL_COLUMNS.status);
  const primaryCostCenterIndex = optionalIndex(headers, OPTIONAL_COLUMNS.primaryCostCenter);
  const allocationsIndex = optionalIndex(headers, OPTIONAL_COLUMNS.allocations);
  const startsNewTreeIndex = optionalIndex(headers, OPTIONAL_COLUMNS.startsNewTree);

  const coreIndexes = resolveCoreIndexes(headers, [
    scenarioIndex,
    basedOnIndex,
    statusIndex,
    primaryCostCenterIndex,
    allocationsIndex,
    startsNewTreeIndex
  ]);

  const parsed = rows
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => {
      const raw = Object.fromEntries(
        CORE_COLUMNS.map((column) => [column, readCell(row, coreIndexes[column])])
      ) as Record<CoreColumn, string>;

      const person: Person = {
        headcount: parseNumber(raw['#']) || 1,
        id: raw.ID,
        name: raw.Nimi,
        title: raw.Tehtava,
        department: raw.Osasto,
        workTimePct: normalizePercent(raw['Työaika %'], 100),
        salary: parseNumber(raw.Kokonaispalkka),
        socialCostPct: normalizePercent(raw['sos. kulup.'], 0),
        managerId: raw.M_ID || null,
        comment: raw.Kommentti,
        primaryCostCenter: readCell(row, primaryCostCenterIndex),
        costAllocations: allocationsIndex >= 0 ? parseAllocations(readCell(row, allocationsIndex)) : [],
        status: statusIndex >= 0 && isParked(readCell(row, statusIndex)) ? 'parked' : 'active',
        startsNewTree: startsNewTreeIndex >= 0 && isTruthy(readCell(row, startsNewTreeIndex)),
        origin: 'imported'
      };

      return {
        person,
        scenarioName: readCell(row, scenarioIndex),
        basedOnName: readCell(row, basedOnIndex)
      };
    });

  if (scenarioIndex < 0) {
    assertValid(parsed.map((item) => item.person), CURRENT_ORGANIZATION);
    return createBaseline(parsed.map((item) => item.person));
  }

  const grouped = new Map<string, { people: Person[]; basedOnName: string }>();
  for (const item of parsed) {
    const name = item.scenarioName || CURRENT_ORGANIZATION;
    const group = grouped.get(name) ?? { people: [], basedOnName: item.basedOnName };
    group.people.push(item.person);
    if (!group.basedOnName && item.basedOnName) group.basedOnName = item.basedOnName;
    grouped.set(name, group);
  }

  const baselineName = BASELINE_ALIASES.find((name) => grouped.has(name)) ?? null;
  if (!baselineName) throw new Error('Bundled CSV must contain “Current organization” or “Nykytila”.');

  const baselinePeople = grouped.get(baselineName)!.people;
  assertValid(baselinePeople, baselineName);
  const project = createBaseline(baselinePeople);
  project.scenarios[0].name = CURRENT_ORGANIZATION;
  const baselineIds = new Set(baselinePeople.map((person) => person.id));

  const pending = [...grouped.entries()].filter(([name]) => name !== baselineName);
  const createdByName = new Map<string, string>(BASELINE_ALIASES.map((name) => [name, project.scenarios[0].id]));

  while (pending.length) {
    const index = pending.findIndex(([, group]) => !group.basedOnName || createdByName.has(group.basedOnName));
    const [name, group] = pending.splice(index >= 0 ? index : 0, 1)[0];
    assertValid(group.people, name);
    const basedOnId = createdByName.get(group.basedOnName) ?? project.scenarios[0].id;
    const scenario = createScenario(project, name, basedOnId);
    scenario.people = deepClone(group.people).map((person) => ({
      ...person,
      origin: baselineIds.has(person.id) ? 'imported' : 'new'
    }));
    scenario.baseSnapshot = deepClone(scenario.people);
    scenario.basedOnScenarioName = group.basedOnName || CURRENT_ORGANIZATION;
    project.scenarios.push(scenario);
    createdByName.set(name, scenario.id);
  }

  return project;
}

export function exportCsvProject(project: Project): string {
  const headers = [
    'Scenario',
    'Based on',
    'Status',
    'Primary cost center',
    'Cost allocations',
    'Start new tree',
    ...EXPORT_CORE_HEADERS
  ];
  const lines = [headers.map(quote).join(';')];

  for (const scenario of project.scenarios) {
    for (const person of scenario.people) {
      const row = [
        scenario.name,
        scenario.basedOnScenarioName ?? '',
        person.status === 'parked' ? 'Parked' : 'Active',
        person.primaryCostCenter,
        formatAllocations(person),
        person.startsNewTree ? 'Yes' : '',
        formatNumber(person.headcount),
        person.id,
        person.name,
        person.title,
        person.department,
        formatNumber(person.workTimePct),
        formatNumber(person.salary),
        formatNumber(person.socialCostPct),
        person.managerId ?? '',
        person.comment
      ];
      lines.push(row.map(quote).join(';'));
    }
  }

  return '\uFEFF' + lines.join('\n');
}

export function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolveCoreIndexes(headers: string[], reservedIndexes: number[]): CoreIndexMap {
  const indexes = Object.fromEntries(CORE_COLUMNS.map((column) => [column, -1])) as CoreIndexMap;
  const taken = new Set<number>(reservedIndexes.filter((index) => index >= 0));

  headers.forEach((header, index) => {
    const column = coreKeyFor(header);
    if (column && indexes[column] < 0) {
      indexes[column] = index;
      taken.add(index);
    }
  });

  const fallbackSlots = headers.map((_, index) => index).filter((index) => !taken.has(index));
  for (const column of CORE_COLUMNS) {
    if (indexes[column] >= 0) continue;
    const slot = fallbackSlots.shift();
    if (slot === undefined) break;
    indexes[column] = slot;
    taken.add(slot);
  }

  const missing = CORE_COLUMNS.filter((column) => indexes[column] < 0);
  if (missing.length) throw new Error(`CSV is missing required columns or positions: ${missing.join(', ')}`);
  return indexes;
}

function readCell(row: string[], index: number): string {
  return index >= 0 ? String(row[index] ?? '').trim() : '';
}

function coreKeyFor(header: string): CoreColumn | null {
  const normalized = normalizeHeader(header);
  for (const key of CORE_COLUMNS) {
    if ([key, ...ALIASES[key]].some((alias) => normalizeHeader(alias) === normalized)) return key;
  }
  return null;
}

function optionalIndex(headers: string[], aliases: readonly string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function normalizeHeader(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\s._%()\-/]/g, '')
    .replace(/[^a-z0-9#]/g, '');
}

function parseNumber(value: string): number {
  let normalized = String(value ?? '').trim().replace(/\s/g, '').replace(/€/g, '').replace('%', '');
  if (!normalized) return 0;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePercent(value: string, fallback: number): number {
  const parsed = parseNumber(value);
  if (!String(value ?? '').trim()) return fallback;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function parseAllocations(value: string): Person['costAllocations'] {
  return value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)\s*%?$/);
      if (!match) throw new Error(`Invalid cost allocation “${part}”. Use e.g. CC100:70|CC200:30.`);
      return { costCenter: match[1].trim(), percent: parseNumber(match[2]) };
    });
}

function formatAllocations(person: Person): string {
  return person.costAllocations.map((allocation) => `${allocation.costCenter}:${formatNumber(allocation.percent)}`).join('|');
}

function splitCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const firstLine = cleaned.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const counts = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length
  };
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ';') as ';' | ',' | '\t';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    const next = cleaned[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function quote(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function isTruthy(value: string): boolean {
  return ['1', 'true', 'yes', 'y', 'kylla', 'kyllä', 'x'].includes(value.trim().toLowerCase());
}

function isParked(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.includes('park') || normalized.includes('häiv') || normalized.includes('haiv');
}

function assertValid(people: Person[], label: string): void {
  const errors = validatePeople(people).filter((issue) => issue.level === 'error');
  if (errors.length) throw new Error(`${label} contains errors:\n\n${errors.map((issue) => issue.message).join('\n')}`);
}
