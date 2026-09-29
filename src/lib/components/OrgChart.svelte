<script lang="ts">
  import { buildOrgLayout, type LayoutMode } from '../org/layout';
  import type { Person } from '../domain/model';

  export let people: Person[] = [];
  export let layoutMode: LayoutMode = 'branches';
  export let zoom = 1;
  export let selectedId: string | null = null;
  export let editable = false;
  export let showSalary = false;
  export let showFte = true;
  export let onSelect: (id: string) => void = () => {};
  export let onMove: (id: string, managerId: string | null) => void = () => {};

  let draggedId: string | null = null;
  $: layout = buildOrgLayout(people, layoutMode);
  $: nodeById = new Map(layout.nodes.map((node) => [node.person.id, node]));

  const euro = (value: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
  const fte = (person: Person) => person.workTimePct / 100;

  function pathFor(personId: string): string {
    const node = nodeById.get(personId);
    if (!node?.visualParentId) return '';
    const parent = nodeById.get(node.visualParentId);
    if (!parent) return '';

    if (layoutMode === 'branches' && node.depth > 0) {
      const trunkX = parent.x + 15;
      const childY = node.y + layout.cardHeight / 2;
      return `M${trunkX},${parent.y + layout.cardHeight} V${childY} H${node.x}`;
    }

    const middleY = parent.y + layout.cardHeight + 32;
    return `M${parent.x + layout.cardWidth / 2},${parent.y + layout.cardHeight} V${middleY} H${node.x + layout.cardWidth / 2} V${node.y}`;
  }

  function startDrag(event: DragEvent, id: string) {
    if (!editable) return;
    draggedId = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dropOn(event: DragEvent, managerId: string | null) {
    if (!editable) return;
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || draggedId;
    if (id) onMove(id, managerId);
    draggedId = null;
  }
</script>

<div class="chart-shell">
  {#if editable}
    <div
      class="root-drop"
      ondragover={(event) => event.preventDefault()}
      ondrop={(event) => dropOn(event, null)}
    >Drop here to remove manager</div>
  {/if}

  {#if layout.nodes.length === 0}
    <div class="empty">No active people in this scenario.</div>
  {:else}
    <div
      class="canvas"
      style={`width:${layout.width}px;height:${layout.height}px;transform:scale(${zoom});transform-origin:top left;`}
    >
      <svg width={layout.width} height={layout.height} aria-hidden="true">
        {#each layout.nodes as node (node.person.id)}
          {#if node.visualParentId}
            <path d={pathFor(node.person.id)} />
          {/if}
        {/each}
      </svg>

      {#each layout.nodes as node (node.person.id)}
        <button
          type="button"
          class:selected={selectedId === node.person.id}
          class:new-role={node.person.origin === 'new'}
          class:tree-root={!node.visualParentId}
          class="person-card"
          style={`left:${node.x}px;top:${node.y}px;width:${layout.cardWidth}px;height:${layout.cardHeight}px;`}
          draggable={editable}
          ondragstart={(event) => startDrag(event, node.person.id)}
          ondragover={(event) => editable && event.preventDefault()}
          ondrop={(event) => dropOn(event, node.person.id)}
          onclick={() => onSelect(node.person.id)}
        >
          {#if node.person.origin === 'new'}<span class="badge">New</span>{/if}
          {#if node.person.startsNewTree}<span class="break-badge">New tree</span>{/if}
          <strong>{node.person.name || node.person.id}</strong>
          <span class="role">{node.person.title || '—'}</span>
          <span class="dept">{node.person.department || 'No department'}</span>
          {#if showFte || showSalary}
            <span class="metrics">
              {#if showFte}{fte(node.person).toFixed(2)} FTE{/if}
              {#if showFte && showSalary}<span>·</span>{/if}
              {#if showSalary}{euro(node.person.salary)}/mo{/if}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chart-shell{position:relative;min-height:420px;overflow:auto;padding:18px 24px 42px;background-image:radial-gradient(#dadbd6 1px,transparent 1px);background-size:22px 22px}
  .canvas{position:relative;margin:12px auto 100px;transition:transform .12s ease}
  svg{position:absolute;inset:0;overflow:visible;pointer-events:none}
  path{fill:none;stroke:#9fa39d;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  .person-card{position:absolute;text-align:left;border:1px solid #d8dad5;border-top:4px solid #5e6f66;background:white;border-radius:12px;padding:12px 13px;box-shadow:0 4px 16px rgba(25,33,28,.06);cursor:pointer;color:#1f2722;overflow:hidden}
  .person-card:hover{border-color:#b8bdb7;box-shadow:0 6px 18px rgba(25,33,28,.09)}
  .person-card.selected{outline:3px solid rgba(68,101,83,.18);border-color:#718679}
  .person-card.new-role{background:#f2f8f3;border-top-color:#7b9b84}
  .person-card.tree-root{box-shadow:0 5px 18px rgba(25,33,28,.1)}
  strong{display:block;font-size:14px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:42px}
  .role,.dept,.metrics{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .role{font-size:12px;margin-top:5px;color:#505953}
  .dept{font-size:11px;margin-top:8px;color:#69736c}
  .metrics{font-size:10px;margin-top:5px;color:#7b837d}
  .metrics span{margin:0 3px}
  .badge,.break-badge{position:absolute;top:8px;right:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;border-radius:99px;padding:3px 6px;background:#e0eee3;color:#41624a}
  .break-badge{top:auto;bottom:8px;background:#efeee8;color:#6d6654}
  .root-drop{position:sticky;top:10px;z-index:4;width:250px;margin:0 auto;border:1px dashed #aeb3ad;border-radius:10px;padding:8px 10px;background:rgba(255,255,255,.92);text-align:center;font-size:11px;color:#6f776f}
  .root-drop:hover{border-color:#77847b;color:#38433c}
  .empty{display:grid;place-items:center;min-height:360px;color:#737c75;font-size:13px}
</style>
