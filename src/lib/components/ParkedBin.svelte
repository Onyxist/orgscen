<script lang="ts">
  import type { Person } from '../domain/model';
  import { calculateTotals } from '../domain/metrics';

  export let people: Person[] = [];
  export let onSelect: (id: string) => void = () => {};
  export let onRestore: (id: string) => void = () => {};
  export let editable = false;
  export let hideSensitive = false;

  $: parked = people.filter((person) => person.status === 'parked').sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id));
  $: totals = calculateTotals(people, 'parked');

  const euro = (value: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
</script>

<section class="bin">
  <div class="head">
    <div>
      <span class="eyebrow">Separate population</span>
      <h3>Parked <span>{parked.length}</span></h3>
    </div>
    <div class="totals">
      <b>{totals.fte.toFixed(2)} FTE</b>
      <span>{hideSensitive ? 'Hidden' : `${euro(totals.totalCost)}/mo`}</span>
    </div>
  </div>

  {#if parked.length === 0}
    <p class="empty">Nobody is parked in this scenario.</p>
  {:else}
    <div class="cards">
      {#each parked as person (person.id)}
        <article>
          <button class="person" type="button" onclick={() => onSelect(person.id)}>
            <strong>{hideSensitive ? `Person ${person.id}` : (person.name || person.id)}</strong>
            <span>{person.title || '—'} · {person.department || 'No department'}</span>
          </button>
          {#if editable}<button class="restore" type="button" onclick={() => onRestore(person.id)}>Restore</button>{/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .bin{border-top:1px solid #dadcd7;background:#f5f4ef;padding:16px 20px 20px}
  .head{display:flex;align-items:flex-end;gap:16px;justify-content:space-between;margin-bottom:12px}
  .eyebrow{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:9px;color:#7f817a}
  h3{margin:2px 0 0;font-size:15px} h3 span{color:#7b817c;font-weight:500}
  .totals{text-align:right}.totals b,.totals span{display:block;font-size:11px}.totals span{color:#767c77;margin-top:2px}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
  article{display:flex;align-items:center;gap:8px;border:1px solid #dddcd5;background:white;border-radius:9px;padding:7px 8px}
  .person{flex:1;border:0;background:transparent;text-align:left;padding:2px;min-width:0;cursor:pointer}
  .person strong,.person span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .person strong{font-size:12px}.person span{font-size:10px;color:#777d78;margin-top:3px}
  .restore{border:1px solid #d5d8d3;background:#fafafa;border-radius:7px;padding:5px 7px;font-size:10px;cursor:pointer}
  .empty{margin:0;color:#81857f;font-size:11px}
</style>
