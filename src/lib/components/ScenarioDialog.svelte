<script lang="ts">
  import type { Scenario } from '../domain/model';
  export let scenarios: Scenario[] = [];
  export let defaultBaseId = 'current';
  export let onCreate: (name: string, basedOnId: string) => void = () => {};
  export let onClose: () => void = () => {};

  let name = '';
  let basedOnId = defaultBaseId;
</script>

<div class="backdrop" role="presentation" onclick={(event) => event.currentTarget === event.target && onClose()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="New scenario">
    <div class="head"><div><span>Scenario</span><h2>New scenario</h2></div><button type="button" onclick={onClose}>×</button></div>
    <label>Name<input bind:value={name} placeholder="e.g. Centralised finance" autofocus /></label>
    <label>Based on
      <select bind:value={basedOnId}>
        {#each scenarios as scenario}
          <option value={scenario.id}>{scenario.name}</option>
        {/each}
      </select>
    </label>
    <p>The new scenario is a snapshot. Later changes to its source do not alter this scenario.</p>
    <div class="actions"><button type="button" onclick={onClose}>Cancel</button><button class="primary" type="button" disabled={!name.trim()} onclick={() => onCreate(name.trim(), basedOnId)}>Create</button></div>
  </div>
</div>

<style>
  .backdrop{position:fixed;inset:0;z-index:80;background:rgba(24,29,26,.3);display:grid;place-items:center;padding:20px}
  .dialog{width:min(460px,100%);background:#fff;border-radius:16px;border:1px solid #d8dad5;box-shadow:0 18px 60px rgba(0,0,0,.18);padding:18px}
  .head{display:flex;justify-content:space-between;align-items:flex-start}.head span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#858b85}.head h2{margin:2px 0 14px;font-size:20px}.head button{border:0;background:transparent;font-size:24px;cursor:pointer;color:#777}
  label{display:block;font-size:11px;color:#666f69;margin:12px 0}input,select{display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #d2d6d1;border-radius:9px;padding:9px 10px;font:inherit;color:#242c27;background:#fff}
  p{font-size:11px;color:#747b75;background:#f6f6f2;padding:9px;border-radius:8px}
  .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.actions button{border:1px solid #d3d6d1;background:white;border-radius:8px;padding:8px 12px;cursor:pointer}.actions .primary{background:#293b31;color:white;border-color:#293b31}.actions button:disabled{opacity:.4;cursor:not-allowed}
</style>
