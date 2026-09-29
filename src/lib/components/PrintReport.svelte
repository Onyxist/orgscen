<script lang="ts">
  import type { Person, Scenario } from '../domain/model';
  import type { PrintConfig } from '../domain/print';
  import { buildVisualForest } from '../org/layout';
  import { calculateTotals, costCenterSummary, departmentSummary } from '../domain/metrics';

  export let scenario: Scenario;
  export let baseline: Scenario;
  export let config: PrintConfig;

  const euro = (value: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
  const dec = (value: number, digits = 2) => new Intl.NumberFormat('en', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value || 0);

  $: forest = buildVisualForest(scenario.people);
  $: branches = forest.roots.map((root) => ({ root, items: flatten(root, 0) }));
  $: active = calculateTotals(scenario.people, 'active');
  $: parked = calculateTotals(scenario.people, 'parked');
  $: combined = calculateTotals(scenario.people, 'combined');
  $: departments = departmentSummary(scenario.people, 'active');
  $: costCenters = costCenterSummary(scenario.people, 'active');
  $: parkedPeople = scenario.people.filter((person) => person.status === 'parked');

  function flatten(person: Person, depth: number, result: { person: Person; depth: number }[] = []) {
    result.push({ person, depth });
    for (const child of forest.children.get(person.id) ?? []) flatten(child, depth + 1, result);
    return result;
  }
</script>

<div id="print-root">
  {#if config.content === 'report' || config.content === 'summary'}
    <section class="print-page summary-page">
      <header><div><span>Organisation scenario</span><h1>{config.title || scenario.name}</h1><p>{scenario.isBaseline ? 'Current organisation' : `Based on: ${scenario.basedOnScenarioName ?? 'Current organisation'}`}</p></div><div class="date">{new Date().toLocaleDateString()}</div></header>
      {#if config.note}<div class="note">{config.note}</div>{/if}
      <div class="population">
        <div><span>Active</span><b>{dec(active.fte)} FTE</b><small>{active.headcount} people{config.financialDetail !== 'none' ? ` · ${euro(active.totalCost)}/mo` : ''}</small></div>
        <div><span>Parked</span><b>{dec(parked.fte)} FTE</b><small>{parked.headcount} people{config.financialDetail !== 'none' ? ` · ${euro(parked.totalCost)}/mo` : ''}</small></div>
        <div><span>Combined</span><b>{dec(combined.fte)} FTE</b><small>{combined.headcount} people{config.financialDetail !== 'none' ? ` · ${euro(combined.totalCost)}/mo` : ''}</small></div>
      </div>

      {#if config.financialDetail !== 'none'}
        <div class="tables two">
          <div><h2>Departments</h2><table><thead><tr><th>Department</th><th>People</th><th>FTE</th><th>Total/mo</th></tr></thead><tbody>{#each departments as row}<tr><td>{row.key}</td><td>{dec(row.headcount,0)}</td><td>{dec(row.fte)}</td><td>{euro(row.totalCost)}</td></tr>{/each}</tbody></table></div>
          <div><h2>Cost centres</h2><table><thead><tr><th>Cost centre</th><th>FTE*</th><th>Salary/mo</th><th>Total/mo</th></tr></thead><tbody>{#each costCenters as row}<tr><td>{row.key}</td><td>{dec(row.fte)}</td><td>{euro(row.salary)}</td><td>{euro(row.totalCost)}</td></tr>{/each}</tbody></table><small class="foot">*FTE belongs entirely to the primary cost centre.</small></div>
        </div>
      {/if}
    </section>
  {/if}

  {#if config.content === 'report' || config.content === 'org'}
    <section class="print-page org-page">
      <header><div><span>Organisation chart</span><h1>{config.title || scenario.name}</h1><p>{active.headcount} active people · {dec(active.fte)} FTE</p></div></header>
      <div class="branches" style={`--cols:${Math.max(1, Math.min(5, branches.length))}`}>
        {#each branches as branch}
          <div class="branch">
            {#each branch.items as item, index}
              <div class:new-role={item.person.origin === 'new'} class="print-person" style={`--depth:${item.depth}`}>
                <b>{item.person.name || item.person.id}{item.person.origin === 'new' ? ' · NEW' : ''}</b>
                <span>{item.person.title || '—'} · {item.person.department || 'No department'}</span>
                {#if item.person.startsNewTree}<em>Visual tree starts here</em>{/if}
                {#if config.financialDetail === 'full'}<small>{dec(item.person.workTimePct / 100)} FTE · {euro(item.person.salary)}/mo · {item.person.primaryCostCenter || 'No cost centre'}</small>{/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if config.includeParked && parkedPeople.length}
    <section class="print-page parked-page">
      <header><div><span>Separate population</span><h1>Parked people</h1><p>{parked.headcount} people · {dec(parked.fte)} FTE{config.financialDetail !== 'none' ? ` · ${euro(parked.totalCost)}/mo` : ''}</p></div></header>
      <table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Primary cost centre</th><th>FTE</th>{#if config.financialDetail === 'full'}<th>Salary/mo</th><th>Total/mo</th>{/if}</tr></thead><tbody>{#each parkedPeople as person}<tr><td><b>{person.name || person.id}</b></td><td>{person.title || '—'}</td><td>{person.department || '—'}</td><td>{person.primaryCostCenter || '—'}</td><td>{dec(person.workTimePct / 100)}</td>{#if config.financialDetail === 'full'}<td>{euro(person.salary)}</td><td>{euro(person.salary * (1 + person.socialCostPct / 100))}</td>{/if}</tr>{/each}</tbody></table>
    </section>
  {/if}
</div>

<style>
  #print-root{display:none}
  @media print{
    #print-root{display:block!important;color:#111;font-family:Arial,Helvetica,sans-serif}
    .print-page{page-break-after:always;break-after:page;width:100%;box-sizing:border-box}.print-page:last-child{page-break-after:auto;break-after:auto}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #aaa;padding-bottom:4mm;margin-bottom:4mm}header span{font-size:7pt;text-transform:uppercase;letter-spacing:.08em;color:#666}header h1{font-size:16pt;margin:1mm 0}header p{font-size:8pt;color:#555;margin:0}.date{font-size:8pt;color:#666}.note{font-size:8pt;border:1px solid #ccc;padding:2.5mm;margin-bottom:4mm}
    .population{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-bottom:4mm}.population div{border:1px solid #ccc;padding:3mm}.population span,.population b,.population small{display:block}.population span{font-size:7pt;text-transform:uppercase;color:#666}.population b{font-size:13pt;margin-top:1mm}.population small{font-size:7.5pt;margin-top:1mm;color:#555}
    .tables.two{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.tables h2{font-size:10pt;margin:0 0 2mm}table{width:100%;border-collapse:collapse;font-size:7pt}th,td{border-bottom:1px solid #ddd;padding:1.6mm 1.4mm;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#f2f2f2;font-size:6.5pt}.foot{font-size:6.5pt;color:#666}
    .branches{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:3mm;align-items:start}.branch{border:1px solid #ccc;padding:2mm;border-radius:2mm}.print-person{margin:.8mm 0 0 calc(var(--depth) * 2.2mm);border-left:1.2mm solid #777;background:#fafafa;padding:1.1mm 1.5mm;break-inside:avoid}.print-person.new-role{background:#eef7f0;border-color:#73927b}.print-person b,.print-person span,.print-person em,.print-person small{display:block}.print-person b{font-size:7.8pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.print-person span{font-size:6.6pt;color:#555;margin-top:.4mm}.print-person em{font-size:6.3pt;color:#6e654e;margin-top:.4mm}.print-person small{font-size:6.3pt;color:#666;margin-top:.4mm}.parked-page table{font-size:7.5pt}
  }
</style>
