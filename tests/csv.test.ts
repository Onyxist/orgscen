import { describe, expect, it } from 'vitest';
import { parseCsvProject } from '../src/lib/io/csv';

describe('CSV import', () => {
  it('accepts the example English header set by column order', () => {
    const csv = [
      'Headcount;ID;Name;Title;Department;Work time %;Salary;Employer cost %;Manager ID;Comment;Primary cost center;Cost allocations',
      '1;CEO;Casey Chief;CEO;Executive;100;8000;25;;;CC100;CC100:100',
      '1;FIN1;Fran Finance;CFO;Finance;100;6000;25;CEO;;CC200;CC200:70|CC300:30'
    ].join('\n');

    const project = parseCsvProject(csv);
    expect(project.scenarios).toHaveLength(1);
    expect(project.scenarios[0].name).toBe('Current organization');
    expect(project.scenarios[0].people[1].workTimePct).toBe(100);
    expect(project.scenarios[0].people[1].primaryCostCenter).toBe('CC200');
    expect(project.scenarios[0].people[1].costAllocations).toEqual([
      { costCenter: 'CC200', percent: 70 },
      { costCenter: 'CC300', percent: 30 }
    ]);
  });
});
