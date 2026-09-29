<script lang="ts">
  import { deepClone, type Person } from '../domain/model';

  export let person: Person;
  export let people: Person[] = [];
  export let editable = false;
  export let onSave: (person: Person) => void = () => {};
  export let onRemove: (id: string) => void = () => {};
  export let onClose: () => void = () => {};

  let draft = deepClone(person);
  $: allocationTotal = draft.costAllocations.reduce((sum, allocation) => sum + Number(allocation.percent || 0), 0);
  $: managers = people.filter((candidate) => candidate.id !== draft.id).sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id));

  function addAllocation() {
    draft.costAllocations = [...draft.costAllocations, { costCenter: '', percent: 0 }];
  }

  function removeAllocation(index: number) {
    draft.costAllocations = draft.costAllocations.filter((_, itemIndex) => itemIndex !== index);
  }

  function usePrimaryOnly() {
    draft.costAllocations = [];
  }
</script>

<aside class="drawer">
  <div class="head">
    <div><span>{editable ? 'Scenario person' : 'Current organization'}</span><h2>{draft.name || draft.id}</h2></div>
    <button type="button" onclick={onClose}>×</button>
  </div>

  {#if !editable}<div class="notice">Current organization is read-only. Create a scenario to edit it.</div>{/if}

  <fieldset disabled={!editable}>
    <div class="grid two"><label>ID<input value={draft.id} disabled /></label><label>Headcount<input type="number" step="0.01" bind:value={draft.headcount} /></label></div>
    <label>Name<input bind:value={draft.name} /></label>
    <label>Role / title<input bind:value={draft.title} /></label>
    <label>Department<input bind:value={draft.department} /></label>
    <div class="grid two"><label>Work time %<input type="number" step="0.01" bind:value={draft.workTimePct} /></label><label>Salary / month<input type="number" step="0.01" bind:value={draft.salary} /></label></div>
    <div class="grid two"><label>Employer cost %<input type="number" step="0.01" bind:value={draft.socialCostPct} /></label><label>Primary cost center<input bind:value={draft.primaryCostCenter} placeholder="e.g. CC100" /></label></div>
    <label>Manager
      <select bind:value={draft.managerId}>
        <option value={null}>— No manager —</option>
        {#each managers as manager}
          <option value={manager.id}>{manager.name || manager.id}{manager.status === 'parked' ? ' · PARKED' : ''}</option>
        {/each}
      </select>
    </label>
    <label>Comment<textarea rows="2" bind:value={draft.comment}></textarea></label>

    <section class="allocation">
      <div class="section-head">
        <div><h3>Salary allocation</h3><p>FTE and headcount always stay 100% in the primary cost center.</p></div>
        <button type="button" onclick={addAllocation}>+ Add split</button>
      </div>

      {#if draft.costAllocations.length === 0}
        <div class="implicit">100% of salary and employer costs → <b>{draft.primaryCostCenter || '(Unassigned)'}</b></div>
      {:else}
        <div class="allocation-list">
          {#each draft.costAllocations as allocation, index}
            <div class="allocation-row">
              <input aria-label="Cost center" placeholder="Cost center" bind:value={allocation.costCenter} />
              <input aria-label="Percentage" type="number" step="0.01" min="0" max="100" bind:value={allocation.percent} />
              <span>%</span>
              <button type="button" aria-label="Remove allocation" onclick={() => removeAllocation(index)}>×</button>
            </div>
          {/each}
        </div>
        <div class:bad={Math.abs(allocationTotal - 100) > 0.01} class="allocation-total">
          Total <b>{allocationTotal.toFixed(2)}%</b>
          <button type="button" onclick={usePrimaryOnly}>Use primary only</button>
        </div>
      {/if}
    </section>

    <section class="switches">
      <label class="switch"><input type="checkbox" checked={draft.status === 'parked'} onchange={(event) => draft.status = event.currentTarget.checked ? 'parked' : 'active'} /><span><b>Park this person</b><small>Moves the person out of the active org into the separate Parked bin and calculates them separately.</small></span></label>
      <label class="switch"><input type="checkbox" bind:checked={draft.startsNewTree} /><span><b>Start a new visual tree</b><small>Keeps the real manager relationship, but removes the connecting line in the org chart.</small></span></label>
    </section>
  </fieldset>

  <div class="actions">
    {#if editable}<button class="danger" type="button" onclick={() => onRemove(draft.id)}>Remove from scenario</button>{/if}
    <span></span>
    <button type="button" onclick={onClose}>Cancel</button>
    {#if editable}<button class="primary" type="button" onclick={() => onSave(deepClone(draft))}>Save</button>{/if}
  </div>
</aside>

<style>
  .drawer{position:fixed;top:0;right:0;bottom:0;z-index:60;width:min(440px,100vw);overflow:auto;background:#fff;border-left:1px solid #d8dad5;box-shadow:-14px 0 38px rgba(0,0,0,.1);padding:18px;box-sizing:border-box;color:#222b25}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #ecece8;padding-bottom:11px;margin-bottom:12px}.head span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#838982}.head h2{font-size:21px;margin:2px 0 0}.head button{border:0;background:transparent;font-size:25px;color:#777;cursor:pointer}
  .notice{font-size:13px;color:#6f766f;background:#f4f4f0;border-radius:8px;padding:9px;margin-bottom:12px}
  fieldset{border:0;padding:0;margin:0}fieldset:disabled{opacity:.72}
  label{display:block;font-size:13px;color:#6f766f;margin:10px 0}input,select,textarea{display:block;width:100%;box-sizing:border-box;border:1px solid #d4d7d2;border-radius:8px;background:#fff;padding:10px 11px;font-size:14px;color:#252d27;margin-top:4px}textarea{resize:vertical}.grid{display:grid;gap:8px}.grid.two{grid-template-columns:1fr 1fr}
  .allocation{margin-top:16px;border:1px solid #dedfd9;background:#fafaf7;border-radius:11px;padding:11px}.section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.section-head h3{font-size:14px;margin:0}.section-head p{font-size:12px;color:#767d77;margin:3px 0 0;max-width:270px}.section-head button,.allocation-total button{border:1px solid #d3d6d0;background:white;border-radius:7px;padding:7px 9px;font-size:12px;cursor:pointer;white-space:nowrap}
  .implicit{font-size:12px;color:#606a63;margin-top:10px;padding:8px;background:white;border-radius:7px}.allocation-list{display:grid;gap:6px;margin-top:9px}.allocation-row{display:grid;grid-template-columns:1fr 78px 12px 26px;gap:5px;align-items:center}.allocation-row input{margin:0;padding:6px 7px}.allocation-row span{font-size:12px;color:#6d746f}.allocation-row button{border:0;background:transparent;font-size:18px;color:#888;cursor:pointer}.allocation-total{display:flex;align-items:center;gap:5px;margin-top:8px;font-size:12px;color:#546057}.allocation-total.bad{color:#9a3d35}.allocation-total button{margin-left:auto}
  .switches{margin-top:14px;border-top:1px solid #ecece7;padding-top:4px}.switch{display:flex;gap:9px;align-items:flex-start;padding:8px 0;margin:0}.switch input{width:auto;margin:2px 0}.switch b,.switch small{display:block}.switch b{font-size:13px;color:#28312b}.switch small{font-size:12px;color:#777e78;margin-top:2px;line-height:1.3}
  .actions{position:sticky;bottom:-18px;background:#fff;border-top:1px solid #e5e6e1;margin:18px -18px -18px;padding:12px 18px;display:grid;grid-template-columns:auto 1fr auto auto;gap:7px}.actions button{border:1px solid #d1d5d0;background:#fff;border-radius:8px;padding:9px 12px;font-size:13px;cursor:pointer}.actions .primary{background:#293b31;color:#fff;border-color:#293b31}.actions .danger{color:#93423a;border-color:#e2c8c5;background:#fffafa}
</style>
