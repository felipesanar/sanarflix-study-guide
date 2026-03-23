// Mock data for Desempenho Institucional v2

export interface KpiData {
  label: string;
  value: string | number;
  icon: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
  description?: string;
}

export interface FaixaDistribuicao {
  faixa: string;
  quantidade: number;
  cor: string;
  percentual: number;
}

export interface MetaInstitucional {
  proficienciaAtual: number;
  meta: number;
  status: string;
  progresso: number;
  gapProficiencia: number;
  notaAtual: number;
  notaMeta: number;
  percentilMedio: number;
  taxaAdesao: number;
}

export interface EvolucaoSimulado {
  simulado: string;
  proficiencia: number;
  nota: number;
}

export interface DistanciaFaixa {
  label: string;
  value: string | number;
  status: 'good' | 'critical' | 'neutral';
  description: string;
}

export const mockKpis: KpiData[] = [
  { label: 'Total de Alunos', value: 57, icon: 'Users', status: 'neutral', description: 'Alunos matriculados' },
  { label: 'Proficiência Média', value: 471.5, icon: 'Target', status: 'warning', description: 'Escala de proficiência' },
  { label: 'Nota da IES', value: 2.98, icon: 'School', status: 'warning', description: 'Nota institucional' },
  { label: 'Faixa Atual', value: 'Intermediário', icon: 'BarChart3', status: 'warning', description: 'Classificação atual' },
  { label: 'Distância Próxima Faixa', value: '29 pts', icon: 'TrendingUp', status: 'warning', description: 'Para próxima faixa' },
  { label: 'Alunos Abaixo do Esperado', value: 20, icon: 'AlertTriangle', status: 'critical', description: 'Precisam de atenção' },
  { label: 'Próximos de Avançar', value: 9, icon: 'ArrowUpRight', status: 'good', description: 'Quase na próxima faixa' },
  { label: 'Taxa de Adesão', value: '95%', icon: 'CheckCircle', status: 'good', description: 'Participação nos simulados' },
];

export const mockFaixas: FaixaDistribuicao[] = [
  { faixa: 'Insuficiente', quantidade: 2, cor: 'hsl(0 84% 60%)', percentual: 3.6 },
  { faixa: 'Regular', quantidade: 16, cor: 'hsl(24 100% 57%)', percentual: 29.1 },
  { faixa: 'Intermediário', quantidade: 12, cor: 'hsl(45 100% 51%)', percentual: 21.8 },
  { faixa: 'Bom', quantidade: 15, cor: 'hsl(142 71% 45%)', percentual: 27.3 },
  { faixa: 'Excelente', quantidade: 10, cor: 'hsl(214 76% 38%)', percentual: 18.2 },
];

export const mockMeta: MetaInstitucional = {
  proficienciaAtual: 471.5,
  meta: 500.0,
  status: 'Bom',
  progresso: 94,
  gapProficiencia: 29,
  notaAtual: 2.98,
  notaMeta: 4.0,
  percentilMedio: 49,
  taxaAdesao: 95,
};

export const mockEvolucao: EvolucaoSimulado[] = [
  { simulado: 'S1 - 2024.1', proficiencia: 441, nota: 2.5 },
  { simulado: 'S2 - 2024.1', proficiencia: 452, nota: 2.7 },
  { simulado: 'S1 - 2024.2', proficiencia: 463, nota: 2.85 },
  { simulado: 'S2 - 2024.2', proficiencia: 471, nota: 2.98 },
];

export const mockDistanciaFaixa: DistanciaFaixa[] = [
  { label: 'Próximos de Avançar', value: 9, status: 'good', description: 'Alunos a menos de 30pts da próxima faixa' },
  { label: 'Muito Abaixo', value: 12, status: 'critical', description: 'Alunos com gap > 100pts' },
  { label: 'Distância Média', value: '29 pts', status: 'neutral', description: 'Gap médio para próxima faixa' },
];
