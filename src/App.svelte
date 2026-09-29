<script lang="ts">
  import { tick } from 'svelte';
  import OrgChart from './lib/components/OrgChart.svelte';
  import ParkedBin from './lib/components/ParkedBin.svelte';
  import PersonEditor from './lib/components/PersonEditor.svelte';
  import SummaryView from './lib/components/SummaryView.svelte';
  import ScenarioDialog from './lib/components/ScenarioDialog.svelte';
  import PrintDialog from './lib/components/PrintDialog.svelte';
  import PrintReport from './lib/components/PrintReport.svelte';
  import {
    createBaseline,
    createScenario,
    currentScenario,
    deepClone,
    defaultPerson,
    resetScenario,
    scenarioById,
    type Person,
    type Project
  } from './lib/domain/model';
  import { validatePeople, wouldCreateCycle } from './lib/domain/validation';
  import { defaultPrintConfig, type PrintConfig } from './lib/domain/print';
  import { downloadText, exportCsvProject, parseCsvProject } from './lib/io/csv';
  import { parseProject, serializeProject } from './lib/io/project';
  import { decryptProject, encryptProject, isEncryptedProject } from './lib/io/crypto';
  import type { LayoutMode } from './lib/org/layout';

  let project: Project | null = null;
  let view: 'org' | 'summary' = 'org';
  let layoutMode: LayoutMode = 'branches';
  let zoom = 0.9;
  let showSalary = false;
  let hideSensitive = false;
  let showFte = true;
  let selectedId: string | null = null;
  let showNewScenario = false;
  let showPrint = false;
  let printConfig: PrintConfig = defaultPrintConfig('Scenario');
  let message = 'Import a CSV or JSON project, or start from scratch.';

  $: scenario = project ? currentScenario(project) : null;
  $: baseline = project?.scenarios.find((item) => item.isBaseline) ?? null;
  $: selectedPerson = scenario?.people.find((person) => person.id === selectedId) ?? null;
  $: issues = scenario ? validatePeople(scenario.people) : [];
  $: errors = issues.filter((issue) => issue.level === 'error');
  $: warnings = issues.filter((issue) => issue.level === 'warning');

  function updateProject(mutator: (draft: Project) => void) {
    if (!project) return;
    const draft = deepClone(project);
    mutator(draft);
    project = draft;
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      if (isEncryptedProject(text)) {
        const password = prompt('Project password');
        if (password === null) return;
        project = await decryptProject(text, password);
      } else {
        project = file.name.toLowerCase().endsWith('.json') ? parseProject(text) : parseCsvProject(text);
      }
      selectedId = null;
      const loaded = currentScenario(project);
      printConfig = defaultPrintConfig(loaded.name);
      message = `${project.scenarios.length} scenario${project.scenarios.length === 1 ? '' : 's'} · ${file.name}`;
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  function switchScenario(id: string) {
    if (!project) return;
    project = { ...project, currentScenarioId: id };
    selectedId = null;
  }

  function startFromScratch() {
    const draft = createBaseline([]);
    const created = createScenario(draft, 'Scenario 1', draft.currentScenarioId);
    draft.scenarios.push(created);
    draft.currentScenarioId = created.id;
    project = draft;
    selectedId = null;
    printConfig = defaultPrintConfig(created.name);
    message = 'Blank project ready. Add roles, or import later if you change your mind.';
  }

  function addScenario(name: string, basedOnId: string) {
    if (!project) return;
    const draft = deepClone(project);
    const created = createScenario(draft, name, basedOnId);
    draft.scenarios.push(created);
    draft.currentScenarioId = created.id;
    project = draft;
    selectedId = null;
    showNewScenario = false;
  }

  function renameScenario() {
    if (!project || !scenario || scenario.isBaseline) return;
    const name = prompt('Scenario name', scenario.name)?.trim();
    if (!name || name === scenario.name) return;
    if (project.scenarios.some((item) => item.name === name && item.id !== scenario.id)) return alert('A scenario with that name already exists.');
    updateProject((draft) => {
      const target = scenarioById(draft, scenario!.id);
      const oldName = target.name;
      target.name = name;
      for (const child of draft.scenarios) {
        if (child.basedOnScenarioId === target.id && child.basedOnScenarioName === oldName) child.basedOnScenarioName = name;
      }
    });
  }

  function deleteScenario() {
    if (!project || !scenario || scenario.isBaseline) return;
    if (!confirm(`Delete scenario “${scenario.name}”? Child scenarios remain independent snapshots.`)) return;
    updateProject((draft) => {
      draft.scenarios = draft.scenarios.filter((item) => item.id !== scenario!.id);
      draft.currentScenarioId = draft.scenarios.find((item) => item.isBaseline)!.id;
    });
    selectedId = null;
  }

  function restoreScenario() {
    if (!project || !scenario || scenario.isBaseline) return;
    if (!confirm(`Reset “${scenario.name}” to the snapshot it was based on?`)) return;
    updateProject((draft) => {
      const index = draft.scenarios.findIndex((item) => item.id === scenario!.id);
      draft.scenarios[index] = resetScenario(draft.scenarios[index]);
    });
    selectedId = null;
  }

  function addPerson() {
    if (!project || !scenario || scenario.isBaseline) return;
    let index = 1;
    let id = `NEW_${index}`;
    while (scenario.people.some((person) => person.id === id)) id = `NEW_${++index}`;
    updateProject((draft) => scenarioById(draft, scenario!.id).people.push(defaultPerson(id)));
    selectedId = id;
  }

  function movePerson(id: string, managerId: string | null) {
    if (!project || !scenario || scenario.isBaseline) return;
    if (wouldCreateCycle(scenario.people, id, managerId)) return alert('That reporting line would create a cycle.');
    updateProject((draft) => {
      const person = scenarioById(draft, scenario!.id).people.find((item) => item.id === id);
      if (person) person.managerId = managerId;
    });
  }

  function savePerson(person: Person) {
    if (!project || !scenario || scenario.isBaseline) return;
    if (wouldCreateCycle(scenario.people, person.id, person.managerId)) return alert('That manager would create a reporting cycle.');
    const people = scenario.people.map((item) => item.id === person.id ? person : item);
    const blocking = validatePeople(people).filter((issue) => issue.level === 'error');
    if (blocking.length) return alert(blocking.map((issue) => issue.message).join('\n'));
    updateProject((draft) => {
      const target = scenarioById(draft, scenario!.id);
      target.people = target.people.map((item) => item.id === person.id ? deepClone(person) : item);
    });
    selectedId = null;
  }

  function removePerson(id: string) {
    if (!project || !scenario || scenario.isBaseline) return;
    const person = scenario.people.find((item) => item.id === id);
    if (!person || !confirm(`Remove ${person.name || person.id} from this scenario? Parking is safer if you still want them included in scenario reporting.`)) return;
    updateProject((draft) => {
      const target = scenarioById(draft, scenario!.id);
      const removed = target.people.find((item) => item.id === id);
      if (!removed) return;
      for (const child of target.people.filter((item) => item.managerId === id)) child.managerId = removed.managerId;
      target.people = target.people.filter((item) => item.id !== id);
    });
    selectedId = null;
  }

  function restoreParked(id: string) {
    if (!project || !scenario || scenario.isBaseline) return;
    updateProject((draft) => {
      const person = scenarioById(draft, scenario!.id).people.find((item) => item.id === id);
      if (person) person.status = 'active';
    });
  }

  function saveProject() {
    if (!project) return;
    if (hideSensitive && !confirm('Privacy mode only hides data on screen. The JSON file contains names and salary data. Continue?')) return;
    downloadText('orgscenario-project.json', serializeProject(project), 'application/json;charset=utf-8');
  }

  async function saveEncryptedProject() {
    if (!project) return;
    const password = prompt('Password for encrypted project file');
    if (!password) return;
    const confirmation = prompt('Type the password again');
    if (confirmation !== password) return alert('Passwords do not match.');
    try {
      const encrypted = await encryptProject(project, password);
      downloadText('orgscenario-project.enc.json', encrypted, 'application/json;charset=utf-8');
      message = 'Encrypted project saved.';
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  function exportCsv() {
    if (!project) return;
    if (hideSensitive && !confirm('Privacy mode only hides data on screen. CSV export contains names and salary data. Continue?')) return;
    downloadText('orgscenario-all-scenarios.csv', exportCsvProject(project), 'text/csv;charset=utf-8');
  }

  function openPrint() {
    if (!scenario) return;
    printConfig = defaultPrintConfig(scenario.name);
    showPrint = true;
  }

  async function printReport(config: PrintConfig) {
    printConfig = config;
    showPrint = false;
    await tick();
    window.print();
  }
</script>

<div id="app-shell">
  <header class="topbar">
    <div class="brand"><div class="mark">O</div><div><h1>OrgScenario</h1><span>Organization & cost scenario modeling</span></div></div>
    <div class="top-actions">
      <label class="file-button">Import<input type="file" accept=".csv,.json,.enc,text/csv,application/json" onchange={(event) => { const file = event.currentTarget.files?.[0]; if (file) importFile(file); event.currentTarget.value = ''; }} /></label>
      <button type="button" disabled={!project} onclick={saveProject}>Save JSON</button>
      <button type="button" disabled={!project} onclick={saveEncryptedProject}>Save encrypted</button>
      <button type="button" disabled={!project} onclick={exportCsv}>Export CSV</button>
      <button type="button" disabled={!project} onclick={openPrint}>Print</button>
    </div>
  </header>

  <div class="workspace">
    <aside class="sidebar">
      <section>
        <span class="section-label">Scenario</span>
        <select disabled={!project} value={project?.currentScenarioId ?? ''} onchange={(event) => switchScenario(event.currentTarget.value)}>
          {#each project?.scenarios ?? [] as item}
            <option value={item.id}>{item.name}</option>
          {/each}
        </select>
        {#if scenario}
          <div class="lineage">{scenario.isBaseline ? 'Read-only comparison base' : `Based on ${scenario.basedOnScenarioName ?? 'Current organization'} · snapshot`}</div>
        {/if}
        <div class="button-grid"><button type="button" disabled={!project} onclick={() => showNewScenario = true}>New…</button><button type="button" disabled={!scenario || scenario.isBaseline} onclick={renameScenario}>Rename</button><button type="button" disabled={!scenario || scenario.isBaseline} onclick={restoreScenario}>Reset</button><button type="button" disabled={!scenario || scenario.isBaseline} onclick={deleteScenario}>Delete</button></div>
      </section>

      <section>
        <span class="section-label">View</span>
        <div class="tabs"><button class:active={view === 'org'} onclick={() => view = 'org'}>Org chart</button><button class:active={view === 'summary'} onclick={() => view = 'summary'}>Summary</button></div>
        {#if view === 'org'}
          <label>Layout<select bind:value={layoutMode}><option value="branches">Compact branches</option><option value="tree">Traditional tree</option></select></label>
          <label>Zoom <span>{Math.round(zoom * 100)}%</span><input type="range" min="0.55" max="1.2" step="0.05" bind:value={zoom} /></label>
          <label class="check"><input type="checkbox" bind:checked={showFte} />Show FTE</label>
          <label class="check"><input type="checkbox" bind:checked={showSalary} disabled={hideSensitive} />Show salary</label>
          <label class="check"><input type="checkbox" bind:checked={hideSensitive} />Hide names & salary</label>
        {/if}
      </section>

      <section>
        <span class="section-label">Edit</span>
        <button class="wide primary" type="button" disabled={!scenario || scenario.isBaseline} onclick={addPerson}>+ Add role</button>
        <p class="hint">Reporting line, department, and cost allocation are separate. Moving a card changes only the reporting line.</p>
      </section>

      {#if project}
        <section>
          <span class="section-label">Validation</span>
          {#if !issues.length}<div class="valid">Structure is valid.</div>{/if}
          {#each errors as issue}<div class="issue error">{issue.message}</div>{/each}
          {#each warnings as issue}<div class="issue warning">{issue.message}</div>{/each}
        </section>
      {/if}

      <section class="privacy"><b>Local-first</b><p>Imported data stays in this browser session. This app does not upload it.</p></section>
    </aside>

    <main>
      {#if !project || !scenario || !baseline}
        <div class="welcome"><div><span>Organization scenario modeling</span><p>Import an existing organization from CSV, or start from scratch.</p><div class="welcome-actions"><label class="file-button primary">Import CSV or JSON<input type="file" accept=".csv,.json,.enc" onchange={(event) => { const file = event.currentTarget.files?.[0]; if (file) importFile(file); event.currentTarget.value = ''; }} /></label><button type="button" class="secondary" onclick={startFromScratch}>Build from scratch</button></div><small>Only runs in your browser.</small></div></div>
      {:else}
        <div class="scenario-bar"><div><span>{scenario.isBaseline ? 'Comparison base' : 'Scenario'}</span><h2>{scenario.name}</h2></div><div class="scenario-meta">{scenario.people.filter((person) => person.status === 'active').length} active · {scenario.people.filter((person) => person.status === 'parked').length} parked</div></div>
        {#if view === 'org'}
          <div class="org-area">
            <OrgChart people={scenario.people} {layoutMode} {zoom} showSalary={showSalary && !hideSensitive} {showFte} {hideSensitive} selectedId={selectedId} editable={!scenario.isBaseline} onSelect={(id) => selectedId = id} onMove={movePerson} />
            <ParkedBin people={scenario.people} {hideSensitive} editable={!scenario.isBaseline} onSelect={(id) => selectedId = id} onRestore={restoreParked} />
          </div>
        {:else}
          <SummaryView people={scenario.people} basePeople={baseline.people} isBaseline={scenario.isBaseline} {hideSensitive} />
        {/if}
      {/if}
    </main>
  </div>
  <footer>{message}</footer>
</div>

{#if showNewScenario && project}<ScenarioDialog scenarios={project.scenarios} defaultBaseId={project.currentScenarioId} onCreate={addScenario} onClose={() => showNewScenario = false} />{/if}
{#if selectedPerson && scenario}
  {#key `${scenario.id}:${selectedPerson.id}`}
    <PersonEditor person={selectedPerson} people={scenario.people} editable={!scenario.isBaseline} onSave={savePerson} onRemove={removePerson} onClose={() => selectedId = null} />
  {/key}
{/if}
{#if showPrint}<PrintDialog config={printConfig} onPrint={printReport} onClose={() => showPrint = false} />{/if}
{#if scenario && baseline}<PrintReport {scenario} {baseline} config={printConfig} {hideSensitive} />{/if}
