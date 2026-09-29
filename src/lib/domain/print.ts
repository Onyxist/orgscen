export type PrintContent = 'report' | 'org' | 'summary';
export type FinancialDetail = 'none' | 'summary' | 'full';

export interface PrintConfig {
  title: string;
  note: string;
  content: PrintContent;
  financialDetail: FinancialDetail;
  includeParked: boolean;
}

export const defaultPrintConfig = (scenarioName: string): PrintConfig => ({
  title: scenarioName,
  note: '',
  content: 'report',
  financialDetail: 'summary',
  includeParked: true
});
