<script lang="ts">
  import type { PrintConfig } from '../domain/print';
  import { deepClone } from '../domain/model';

  export let config: PrintConfig;
  export let onPrint: (config: PrintConfig) => void = () => {};
  export let onClose: () => void = () => {};

  let draft = deepClone(config);
</script>

<div class="backdrop" role="presentation" onclick={(event) => event.currentTarget === event.target && onClose()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Print report">
    <div class="head"><div><span>Purpose-built output</span><h2>Print / save report</h2></div><button type="button" onclick={onClose}>×</button></div>
    <label>Report title<input bind:value={draft.title} /></label>
    <label>Note<textarea rows="2" bind:value={draft.note} placeholder="Optional context for the recipient"></textarea></label>
    <div class="grid">
      <label>Content<select bind:value={draft.content}><option value="report">Scenario report</option><option value="org">Org chart only</option><option value="summary">Summary only</option></select></label>
      <label>Financial detail<select bind:value={draft.financialDetail}><option value="none">None</option><option value="summary">Aggregated totals</option><option value="full">Full salary detail</option></select></label>
    </div>
    <label class="check"><input type="checkbox" bind:checked={draft.includeParked} /><span>Include parked people as a separate section</span></label>
    <p>The print view is built separately from the app UI and formatted for A4 landscape. The browser’s print dialog is only used to send that clean document to a printer or PDF.</p>
    <div class="actions"><button type="button" onclick={onClose}>Cancel</button><button class="primary" type="button" onclick={() => onPrint(deepClone(draft))}>Open print dialog</button></div>
  </div>
</div>

<style>
  .backdrop{position:fixed;inset:0;z-index:85;background:rgba(24,29,26,.3);display:grid;place-items:center;padding:20px}.dialog{width:min(520px,100%);background:#fff;border:1px solid #d8dad5;border-radius:16px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.18)}.head{display:flex;justify-content:space-between;align-items:flex-start}.head span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#858b85}.head h2{font-size:20px;margin:2px 0 14px}.head button{border:0;background:transparent;font-size:24px;color:#777;cursor:pointer}label{display:block;font-size:10px;color:#69716b;margin:10px 0}input,textarea,select{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #d2d6d1;border-radius:8px;padding:8px 9px;font:inherit;background:white;color:#252d27}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.check{display:flex;gap:8px;align-items:center}.check input{width:auto;margin:0}.check span{font-size:11px;color:#303a33}p{font-size:10px;color:#727a74;background:#f6f6f2;padding:9px;border-radius:8px}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.actions button{border:1px solid #d3d6d1;background:#fff;border-radius:8px;padding:8px 11px;font-size:10px;cursor:pointer}.actions .primary{background:#293b31;color:white;border-color:#293b31}
</style>
