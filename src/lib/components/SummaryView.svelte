<script lang="ts">
  import type { Person } from '../domain/model';
  import { calculateTotals, costCenterSummary, departmentSummary, type Population } from '../domain/metrics';

  export let people: Person[] = [];
  export let basePeople: Person[] = [];
  export let isBaseline = false;
  export let hideSensitive = false;

  let population: Population = 'active';
  let table: 'department' | 'cost-center' = 'department';

  const euro = (value: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
  const number = (value: number, digits = 2) => new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
  const changeFor = (key: string, total: number) => isBaseline ? 0 : total - (baseByKey.get(key)?.totalCost ?? 0);

  $: active = calculateTotals(people, 'active');
  $: parked = calculateTotals(people, 'parked');
  $: combined = calculateTotals(people, 'combined');
  $: rows = table === 'department' ? departmentSummary(people, population) : costCenterSummary(people, population);
  $: baseRows = table === 'department' ? departmentSummary(basePeople, population) : costCenterSummary(basePeople, population);
  $: baseByKey = new Map(baseRows.map((row) => [row.key, row]));
  $: selectedTotals = population === 'active' ? active : population === 'parked' ? parked : combined;
  $: kpis = [
    ['Headcount', String(selectedTotals.headcount)],
    ['FTE', number(selectedTotals.fte)],
    ['Weekly hours', `${number(selectedTotals.weeklyHours, 1)} h`],
    ['Salary / month', hideSensitive ? 'Hidden' : euro(selectedTotals.salary)],
    ['Employer cost / month', hideSensitive ? 'Hidden' : euro(selectedTotals.socialCost)],
    ['Total / month', hideSensitive ? 'Hidden' : euro(selectedTotals.totalCost)]
  ];

</script>

<div class="summary">
  <div class="population-cards">
    <button class:active={population === 'active'} onclick={() => population = 'active'}>
      <span>Active</span><strong>{number(active.fte)} FTE</strong><small>{active.headcount} people{hideSensitive ? '' : ` · ${euro(active.totalCost)}/mo`}</small>
    </button>
    <button class:active={population === 'parked'} onclick={() => population = 'parked'}>
      <span>Parked</span><strong>{number(parked.fte)} FTE</strong><small>{parked.headcount} people{hideSensitive ? '' : ` · ${euro(parked.totalCost)}/mo`}</small>
    </button>
    <button class:active={population === 'combined'} onclick={() => population = 'combined'}>
      <span>Combined</span><strong>{number(combined.fte)} FTE</strong><small>{combined.headcount} people{hideSensitive ? '' : ` · ${euro(combined.totalCost)}/mo`}</small>
    </button>
  </div>

  <div class="kpis">
    {#each kpis as item}
      <div class="kpi"><span>{item[0]}</span><strong>{item[1]}</strong></div>
    {/each}
  </div>

  <div class="panel">
    <div class="panel-head">
      <div><span>{population} population</span><h3>{table === 'department' ? 'Department summary' : 'Cost center summary'}</h3></div>
      <div class="tabs"><button class:active={table === 'department'} onclick={() => table = 'department'}>Departments</button><button class:active={table === 'cost-center'} onclick={() => table = 'cost-center'}>Cost centers</button></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>{table === 'department' ? 'Department' : 'Cost center'}</th><th>People</th><th>FTE</th><th>Hours/wk</th><th>Salary/mo</th><th>Employer cost</th><th>Total/mo</th><th>Change/mo</th><th>Annual</th></tr></thead>
        <tbody>
          {#each rows as row (row.key)}
            <tr>
              <td><b>{row.key}</b></td><td>{number(row.headcount,0)}</td><td>{number(row.fte)}</td><td>{number(row.weeklyHours,1)}</td><td>{hideSensitive ? 'Hidden' : euro(row.salary)}</td><td>{hideSensitive ? 'Hidden' : euro(row.socialCost)}</td><td><b>{hideSensitive ? 'Hidden' : euro(row.totalCost)}</b></td><td class:up={!hideSensitive && changeFor(row.key,row.totalCost) > 0} class:down={!hideSensitive && changeFor(row.key,row.totalCost) < 0}>{hideSensitive ? 'Hidden' : (isBaseline ? '—' : `${changeFor(row.key,row.totalCost) > 0 ? '+' : ''}${euro(changeFor(row.key,row.totalCost))}`)}</td><td>{hideSensitive ? 'Hidden' : euro(row.annualCost)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if table === 'cost-center'}<p class="footnote">Headcount and FTE are assigned entirely to the primary cost center. Salary and employer costs follow the person’s salary allocation.</p>{/if}
  </div>
</div>

<style>
  .summary{padding:18px;display:grid;gap:14px}.population-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.population-cards button{border:1px solid #d9dcd7;background:#fff;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.population-cards button.active{border-color:#819187;box-shadow:0 0 0 3px rgba(64,92,76,.08)}.population-cards span,.population-cards strong,.population-cards small{display:block}.population-cards span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#787f79}.population-cards strong{font-size:18px;margin-top:3px}.population-cards small{font-size:10px;color:#777f79;margin-top:3px}
  .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.kpi{border:1px solid #dedfda;background:#fafaf7;border-radius:10px;padding:10px}.kpi span,.kpi strong{display:block}.kpi span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#7b817b}.kpi strong{font-size:14px;margin-top:4px}
  .panel{border:1px solid #dadcd7;background:white;border-radius:13px;overflow:hidden}.panel-head{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid #ecece8}.panel-head span{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#7c827c}.panel-head h3{font-size:14px;margin:2px 0 0}.tabs{display:flex;background:#f1f2ee;border-radius:8px;padding:3px}.tabs button{border:0;background:transparent;border-radius:6px;padding:6px 9px;font-size:10px;cursor:pointer}.tabs button.active{background:white;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:9px 10px;border-bottom:1px solid #ededea;text-align:right;font-size:10px}th{font-size:9px;color:#747b75;background:#fafaf8}th:first-child,td:first-child{text-align:left}.up{color:#9b443b}.down{color:#3b7450}.footnote{font-size:9.5px;color:#727a74;margin:0;padding:9px 12px;background:#fafaf7}
  @media(max-width:1000px){.kpis{grid-template-columns:repeat(3,1fr)}}
</style>
