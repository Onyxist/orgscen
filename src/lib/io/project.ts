import { deepClone, type Project } from '../domain/model';
import { validatePeople } from '../domain/validation';

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function parseProject(text: string): Project {
  const parsed = JSON.parse(text) as Partial<Project>;
  if (parsed.format !== 'orgscenario' || parsed.version !== 1 || !Array.isArray(parsed.scenarios)) {
    throw new Error('This is not a supported OrgScenario project file.');
  }
  if (!parsed.currentScenarioId || !parsed.scenarios.some((scenario) => scenario.id === parsed.currentScenarioId)) {
    throw new Error('Project has no valid current scenario.');
  }

  for (const scenario of parsed.scenarios) {
    if (!scenario.id || !scenario.name || !Array.isArray(scenario.people) || !Array.isArray(scenario.baseSnapshot)) {
      throw new Error('Project contains an invalid scenario.');
    }
    const errors = validatePeople(scenario.people).filter((issue) => issue.level === 'error');
    if (errors.length) throw new Error(`${scenario.name}:\n${errors.map((issue) => issue.message).join('\n')}`);
  }

  return deepClone(parsed as Project);
}
