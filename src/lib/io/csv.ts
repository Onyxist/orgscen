import { createBaseline, createScenario, deepClone, type Person, type Project } from '../domain/model';
import { validatePeople } from '../domain/validation';

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

const OPTIONAL_COLUMNS = {
  scenario: ['Skenaario', 'Scenario'],
  basedOn: ['Perustuu', 'Based on', 'BasedOn'],
  status: ['Tila', 'Status'],
  primaryCostCenter: ['Ensisijainen kustannuspaikka', 'Kustannuspaikka', 'Primary cost centre', 'Primary cost center'],
  allocations: ['Kustannusjako', 'Palkkajako', 'Cost allocations', 'Cost allocation'],
  startsNewTree: ['Uusi puu', 'Aloita uusi puu', 'Start new tree', 'Visual break']
} as const;

const ALIASES: Record<(typeof CORE_COLUMNS)[number], string[]> = {
  '#': ['#', 'lkm', 'maara', 'määrä', 'henkilomaara', 'henkilömäärä'],
  ID: ['id', 'henkiloid', 'henkilöid'],
  Nimi: ['nimi', 'name'],
  Tehtava: ['tehtava', 'tehtävä', 'rooli', 'role', 'title'],
  Osasto: ['osasto', 'department', 'dept'],
  'Työaika %': ['tyoaika%', 'työaika%', 'tyoaika', 'työaika', 'fte%'],
  Kokonaispalkka: ['kokonaispalkka', 'palkka', 'salary'],
  'sos. kulup.': ['sos.kulup.', 'sos kulup.', 'soskulup', 'sosiaalikulup', 'sosiaalikulu%', 'sosiaalikulut%', 'socialcost%', 'employercost%'],
  M_ID: ['m_id', 'mid', 'managerid', 'esihenkiloid', 'esihenkilöid'],
  Kommentti: ['kommentti', 'comment', 'comments', 'notes']
};

export function parseCsvProject(text: string): Project {
  const rows = splitCsv(text);
  if (!rows.length) throw new Error('CSV is empty.');

  const headers = rows[0].map((value) => value.trim());
  const coreMap = headers.map(coreKeyFor);
  const missing = CORE_COLUMNS.filter((column) => !coreMap.includes(column));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

  const scenarioIndex = optionalIndex(headers, OPTIONAL_COLUMNS.scenario);
  const basedOnIndex = optionalIndex(headers, OPTIONAL_COLUMNS.basedOn);
  const statusIndex = optionalIndex(headers, OPTIONAL_COLUMNS.status);
  const primaryCostCenterIndex = optionalIndex(headers, OPTIONAL_COLUMNS.primaryCostCenter);
  const allocationsIndex = optionalIndex(headers, OPTIONAL_COLUMNS.allocations);
  const startsNewTreeIndex = optionalIndex(headers, OPTIONAL_COLUMNS.startsNewTree);

  const parsed = rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row) => {
    const raw = Object.fromEntries(CORE_COLUMNS.map((column) => [column, ''])) as Record<(typeof CORE_COLUMNS)[number], string>;
    coreMap.forEach((column, index) => {
      if (column) raw[column] = String(row[index] ?? '').trim();
    });

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
      primaryCostCenter: primaryCostCenterIndex >= 0 ? String(row[primaryCostCenterIndex] ?? '').trim() : '',
      costAllocations: allocationsIndex >= 0 ? parseAllocations(String(row[allocationsIndex] ?? '')) : [],
      status: statusIndex >= 0 && isParked(String(row[statusIndex] ?? '')) ? 'parked' : 'active',
      startsNewTree: startsNewTreeIndex >= 0 && isTruthy(String(row[startsNewTreeIndex] ?? '')),
      origin: 'imported'
    };

    return {
      person,
      scenarioName: scenarioIndex >= 0 ? String(row[scenarioIndex] ?? '').trim() : '',
      basedOnName: basedOnIndex >= 0 ? String(row[basedOnIndex] ?? '').trim() : ''
    };
  });

  if (scenarioIndex < 0) {
    assertValid(parsed.map((item) => item.person), 'Current organisation');
    return createBaseline(parsed.map((item) => item.person));
  }

  const grouped = new Map<string, { people: Person[]; basedOnName: string }>();
  for (const item of parsed) {
    const name = item.scenarioName || 'Current organisation';
    const group = grouped.get(name) ?? { people: [], basedOnName: item.basedOnName };
    group.people.push(item.person);
    if (!group.basedOnName && item.basedOnName) group.basedOnName = item.basedOnName;
    grouped.set(name, group);
  }

  const baselineName = grouped.has('Current organisation')
    ? 'Current organisation'
    : grouped.has('Nykytila')
      ? 'Nykytila'
      : null;
  if (!baselineName) throw new Error('Bundled CSV must contain “Current organisation” or “Nykytila”.');

  const baselinePeople = grouped.get(baselineName)!.people;
  assertValid(baselinePeople, baselineName);
  const project = createBaseline(baselinePeople);
  project.scenarios[0].name = 'Current organisation';
  const baselineIds = new Set(baselinePeople.map((person) => person.id));

  const pending = [...grouped.entries()].filter(([name]) => name !== baselineName);
  const createdByName = new Map<string, string>([['Current organisation', project.scenarios[0].id], ['Nykytila', project.scenarios[0].id]]);

  while (pending.length) {
    const index = pending.findIndex(([, group]) => !group.basedOnName || createdByName.has(group.basedOnName));
    const [name, group] = pending.splice(index >= 0 ? index : 0, 1)[0];
    assertValid(group.people, name);
    const basedOnId = createdByName.get(group.basedOnName) ?? project.scenarios[0].id;
    const scenario = createScenario(project, name, basedOnId);
    scenario.people = deepClone(group.people).map((person) => ({ ...person, origin: baselineIds.has(person.id) ? 'imported' : 'new' }));
    scenario.baseSnapshot = deepClone(scenario.people);
    scenario.basedOnScenarioName = group.basedOnName || 'Current organisation';
    project.scenarios.push(scenario);
    createdByName.set(name, scenario.id);
  }

  return project;
}

export function exportCsvProject(project: Project): string {
  const headers = [
    'Scenario', 'Based on', 'Status', 'Primary cost centre', 'Cost allocations', 'Start new tree',
    ...CORE_COLUMNS
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

function coreKeyFor(header: string): (typeof CORE_COLUMNS)[number] | null {
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
