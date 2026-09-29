import type { Person } from '../domain/model';

export type LayoutMode = 'branches' | 'tree';

export interface PositionedPerson {
  person: Person;
  x: number;
  y: number;
  depth: number;
  visualParentId: string | null;
}

export interface VisualForest {
  roots: Person[];
  children: Map<string, Person[]>;
  parentById: Map<string, string | null>;
}

export interface OrgLayout {
  nodes: PositionedPerson[];
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
}

export function visualParentId(person: Person, byId: Map<string, Person>): string | null {
  if (person.startsNewTree || !person.managerId) return null;
  const manager = byId.get(person.managerId);
  if (!manager || manager.status === 'parked') return null;
  return manager.id;
}

export function buildVisualForest(people: Person[]): VisualForest {
  const active = people.filter((person) => person.status === 'active');
  const byId = new Map(active.map((person) => [person.id, person]));
  const parentById = new Map(active.map((person) => [person.id, visualParentId(person, byId)]));
  const allChildren = new Map<string | null, Person[]>();

  for (const person of active) {
    const parent = parentById.get(person.id) ?? null;
    const list = allChildren.get(parent) ?? [];
    list.push(person);
    allChildren.set(parent, list);
  }
  for (const list of allChildren.values()) list.sort(sortPeople);
  const children = new Map<string, Person[]>();
  for (const [key, list] of allChildren) if (key !== null) children.set(key, list);
  return { roots: allChildren.get(null) ?? [], children, parentById };
}

export function buildOrgLayout(people: Person[], mode: LayoutMode): OrgLayout {
  const active = people.filter((person) => person.status === 'active');
  const forest = buildVisualForest(people);
  const children = new Map<string | null, Person[]>();
  children.set(null, forest.roots);
  for (const [key, list] of forest.children) children.set(key, list);

  return mode === 'tree'
    ? buildTree(active, children, forest.parentById)
    : buildBranches(active, children, forest.parentById);
}

function buildTree(
  active: Person[],
  children: Map<string | null, Person[]>,
  visualParent: Map<string, string | null>
): OrgLayout {
  const cardWidth = 216;
  const cardHeight = 108;
  const gapX = 28;
  const gapY = 66;
  const positions = new Map<string, PositionedPerson>();
  const roots = children.get(null) ?? [];

  const widthMemo = new Map<string, number>();
  const widthOf = (person: Person): number => {
    const cached = widthMemo.get(person.id);
    if (cached !== undefined) return cached;
    const kids = children.get(person.id) ?? [];
    const width = kids.length
      ? Math.max(cardWidth, kids.reduce((sum, kid) => sum + widthOf(kid), 0) + gapX * (kids.length - 1))
      : cardWidth;
    widthMemo.set(person.id, width);
    return width;
  };

  const place = (person: Person, depth: number, left: number): number => {
    const subtreeWidth = widthOf(person);
    const kids = children.get(person.id) ?? [];
    positions.set(person.id, {
      person,
      x: left + (subtreeWidth - cardWidth) / 2,
      y: depth * (cardHeight + gapY) + 20,
      depth,
      visualParentId: visualParent.get(person.id) ?? null
    });

    if (kids.length) {
      const childrenWidth = kids.reduce((sum, kid) => sum + widthOf(kid), 0) + gapX * (kids.length - 1);
      let cursor = left + (subtreeWidth - childrenWidth) / 2;
      for (const kid of kids) {
        const kidWidth = widthOf(kid);
        place(kid, depth + 1, cursor);
        cursor += kidWidth + gapX;
      }
    }
    return subtreeWidth;
  };

  let cursor = 20;
  for (const root of roots) {
    if (cursor > 20) cursor += gapX * 2;
    cursor += place(root, 0, cursor);
  }

  const nodes = active.map((person) => positions.get(person.id)).filter(Boolean) as PositionedPerson[];
  return {
    nodes,
    width: Math.max(520, ...nodes.map((node) => node.x + cardWidth + 20)),
    height: Math.max(240, ...nodes.map((node) => node.y + cardHeight + 36)),
    cardWidth,
    cardHeight
  };
}

function buildBranches(
  active: Person[],
  children: Map<string | null, Person[]>,
  visualParent: Map<string, string | null>
): OrgLayout {
  const cardWidth = 208;
  const cardHeight = 84;
  const indent = 28;
  const maxIndent = 84;
  const rowGap = 11;
  const branchGap = 30;
  const roots = children.get(null) ?? [];
  const maxColumns = 5;
  const columns = Math.max(1, Math.min(maxColumns, roots.length || 1));
  const branchWidth = cardWidth + maxIndent + 34;
  const width = Math.max(620, 44 + columns * branchWidth + (columns - 1) * branchGap);

  const flatten = (person: Person, depth = 0, result: { person: Person; depth: number }[] = []) => {
    result.push({ person, depth });
    for (const child of children.get(person.id) ?? []) flatten(child, depth + 1, result);
    return result;
  };

  const branches = roots.map((root) => flatten(root));
  const rowHeights: number[] = [];
  for (let i = 0; i < branches.length; i += columns) {
    const row = branches.slice(i, i + columns);
    rowHeights.push(Math.max(cardHeight, ...row.map((items) => items.length * (cardHeight + rowGap) - rowGap)));
  }

  const nodes: PositionedPerson[] = [];
  for (let branchIndex = 0; branchIndex < branches.length; branchIndex += 1) {
    const row = Math.floor(branchIndex / columns);
    const column = branchIndex % columns;
    const yBase = 22 + rowHeights.slice(0, row).reduce((sum, value) => sum + value, 0) + row * 40;
    const xBase = 22 + column * (branchWidth + branchGap);
    for (let index = 0; index < branches[branchIndex].length; index += 1) {
      const { person, depth } = branches[branchIndex][index];
      nodes.push({
        person,
        x: xBase + Math.min(maxIndent, depth * indent),
        y: yBase + index * (cardHeight + rowGap),
        depth,
        visualParentId: visualParent.get(person.id) ?? null
      });
    }
  }

  const height = Math.max(240, ...nodes.map((node) => node.y + cardHeight + 34));
  return { nodes, width, height, cardWidth, cardHeight };
}

function sortPeople(a: Person, b: Person): number {
  return (a.name || a.id).localeCompare(b.name || b.id, 'en');
}
