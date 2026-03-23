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
  percentProficientes?: number;
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

export interface StudentBelowExpected {
  nome: string;
  proficienciaTri: number;
  percentualAcerto: number;
  distanciaAteProficiencia: number;
  turma: string;
  periodo: string;
}

export const mockKpis: KpiData[] = [
  { label: 'Total de Alunos', value: 100, icon: 'Users', status: 'neutral', description: 'Alunos matriculados' },
  { label: 'Proficiência Média (TRI)', value: 452.3, icon: 'Target', status: 'warning', description: 'Escala de proficiência' },
  { label: 'Percentual de alunos proficientes (%)', value: '35.0%', icon: 'CheckCircle', status: 'critical', description: 'Alunos proficientes (TRI)' },
  { label: 'Nota Prevista da IES', value: 2.12, icon: 'School', status: 'critical', description: 'Nota institucional' },
  { label: 'Distância Próxima Faixa', value: '18 pts', icon: 'TrendingUp', status: 'warning', description: 'Para a próxima faixa' },
  { label: 'Alunos Abaixo do Esperado', value: 65, icon: 'AlertTriangle', status: 'critical', description: 'Não proficientes (TRI)' },
  { label: 'Taxa de Adesão', value: '92%', icon: 'CheckCircle', status: 'good', description: 'Participação nos simulados' },
];

export const mockFaixas: FaixaDistribuicao[] = [
  { faixa: 'Insuficiente', quantidade: 20, cor: 'hsl(0 84% 60%)', percentual: 20.0 },
  { faixa: 'Regular', quantidade: 25, cor: 'hsl(24 100% 57%)', percentual: 25.0 },
  { faixa: 'Intermediário', quantidade: 20, cor: 'hsl(45 100% 51%)', percentual: 20.0 },
  { faixa: 'Bom', quantidade: 20, cor: 'hsl(142 71% 45%)', percentual: 20.0 },
  { faixa: 'Excelente', quantidade: 15, cor: 'hsl(214 76% 38%)', percentual: 15.0 },
];

export const mockMeta: MetaInstitucional = {
  proficienciaAtual: 452.3,
  meta: 500.0,
  status: 'Sanção ativa',
  progresso: 90,
  gapProficiencia: 47.7,
  notaAtual: 2.12,
  notaMeta: 3.8,
  percentilMedio: 35,
  taxaAdesao: 92,
  percentProficientes: 35.0,
};

export const mockEvolucao: EvolucaoSimulado[] = [
  { simulado: 'S1 - 2024.1', proficiencia: 435, nota: 1.95 },
  { simulado: 'S2 - 2024.1', proficiencia: 444, nota: 2.02 },
  { simulado: 'S1 - 2024.2', proficiencia: 449, nota: 2.08 },
  { simulado: 'S2 - 2024.2', proficiencia: 452.3, nota: 2.12 },
];

export const mockDistanciaFaixa: DistanciaFaixa[] = [
  { label: 'Até 20 pontos', value: '18 alunos a até 20 pontos', status: 'good', description: 'Distância para a próxima faixa' },
  { label: 'Entre 20 e 40 pontos', value: '22 alunos entre 20 e 40 pontos', status: 'neutral', description: 'Distância para a próxima faixa' },
  { label: 'Acima de 40 pontos', value: '25 alunos acima de 40 pontos', status: 'critical', description: 'Distância para a próxima faixa' },
];

export const mockAlunosAbaixo: StudentBelowExpected[] = [
  { nome: 'Ana Silva', proficienciaTri: 438, percentualAcerto: 54, distanciaAteProficiencia: 6, turma: 'Medicina A', periodo: '2024.2' },
  { nome: 'Bruno Souza', proficienciaTri: 452, percentualAcerto: 57, distanciaAteProficiencia: 3, turma: 'Medicina B', periodo: '2024.2' },
  { nome: 'Carla Mendes', proficienciaTri: 421, percentualAcerto: 50, distanciaAteProficiencia: 10, turma: 'Medicina A', periodo: '2024.2' },
  { nome: 'Diego Ramos', proficienciaTri: 468, percentualAcerto: 59, distanciaAteProficiencia: 1, turma: 'Medicina C', periodo: '2024.2' },
  { nome: 'Eduarda Lima', proficienciaTri: 445, percentualAcerto: 56, distanciaAteProficiencia: 4, turma: 'Medicina B', periodo: '2024.2' },
  { nome: 'Felipe Rocha', proficienciaTri: 409, percentualAcerto: 48, distanciaAteProficiencia: 12, turma: 'Medicina A', periodo: '2024.2' },
  { nome: 'Gabriela Nunes', proficienciaTri: 432, percentualAcerto: 53, distanciaAteProficiencia: 7, turma: 'Medicina C', periodo: '2024.2' },
  { nome: 'Henrique Costa', proficienciaTri: 416, percentualAcerto: 49, distanciaAteProficiencia: 11, turma: 'Medicina B', periodo: '2024.2' },
  { nome: 'Isabela Freitas', proficienciaTri: 440, percentualAcerto: 55, distanciaAteProficiencia: 5, turma: 'Medicina A', periodo: '2024.2' },
  { nome: 'João Pereira', proficienciaTri: 458, percentualAcerto: 58, distanciaAteProficiencia: 2, turma: 'Medicina C', periodo: '2024.2' },
];
