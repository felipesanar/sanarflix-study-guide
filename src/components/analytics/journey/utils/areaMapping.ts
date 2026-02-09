// Mapeamento de matérias para Grandes Áreas do conhecimento
// Usado para correlacionar study_progress com questoes_simulado

export const AREA_MAPPING: Record<string, string[]> = {
  'Clínica Médica': [
    'clínica médica',
    'clinica medica',
    'fisiopatologia',
    'semiologia',
    'farmacologia',
    'medicina laboratorial',
    'fisiologia',
    'cardiologia',
    'pneumologia',
    'gastroenterologia',
    'nefrologia',
    'hematologia',
    'endocrinologia',
    'reumatologia',
    'neurologia',
    'infectologia',
    'dermatologia',
    'geriatria',
  ],
  'Cirurgia': [
    'cirurgia',
    'técnica cirúrgica',
    'tecnica cirurgica',
    'clínica cirúrgica',
    'clinica cirurgica',
    'urgência',
    'urgencia',
    'emergência',
    'emergencia',
    'trauma',
    'ortopedia',
    'urologia',
    'oftalmologia',
    'otorrinolaringologia',
    'anestesiologia',
  ],
  'Pediatria': [
    'pediatria',
    'saúde da criança',
    'saude da crianca',
    'adolescente',
    'neonatologia',
    'puericultura',
  ],
  'Ginecologia e Obstetrícia': [
    'ginecologia',
    'obstetrícia',
    'obstetricia',
    'saúde da mulher',
    'saude da mulher',
    'toco',
    'mastologia',
  ],
  'Saúde Mental': [
    'saúde mental',
    'saude mental',
    'psiquiatria',
    'psicologia médica',
    'psicologia medica',
  ],
  'Medicina Preventiva/Saúde Coletiva': [
    'saúde coletiva',
    'saude coletiva',
    'epidemiologia',
    'políticas públicas',
    'politicas publicas',
    'bioestatística',
    'bioestatistica',
    'ciências sociais',
    'ciencias sociais',
    'saúde do trabalhador',
    'saude do trabalhador',
    'medicina preventiva',
    'vigilância',
    'vigilancia',
  ],
  'Medicina de Família e Comunidade': [
    'medicina da família',
    'medicina da familia',
    'comunidade',
    'atenção primária',
    'atencao primaria',
    'aps',
    'esf',
    'estratégia saúde da família',
  ],
};

/**
 * Mapeia uma matéria para sua Grande Área correspondente
 * Usa fuzzy matching (includes) para lidar com variações de nomenclatura
 */
export function mapMateriaToArea(materia: string): string | null {
  const normalized = materia.toLowerCase().trim();
  
  for (const [area, keywords] of Object.entries(AREA_MAPPING)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return area;
      }
    }
  }
  
  return null;
}

/**
 * Calcula o coeficiente de correlação de Pearson
 * Retorna um valor entre -1 e 1:
 * - 1: correlação positiva perfeita
 * - 0: sem correlação
 * - -1: correlação negativa perfeita
 */
export function calculatePearsonCorrelation(
  data: { study: number; accuracy: number }[]
): number {
  const n = data.length;
  if (n < 2) return 0;
  
  const sumX = data.reduce((s, d) => s + d.study, 0);
  const sumY = data.reduce((s, d) => s + d.accuracy, 0);
  const sumXY = data.reduce((s, d) => s + d.study * d.accuracy, 0);
  const sumX2 = data.reduce((s, d) => s + d.study * d.study, 0);
  const sumY2 = data.reduce((s, d) => s + d.accuracy * d.accuracy, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  
  const correlation = numerator / denominator;
  
  // Arredondar para 2 casas decimais
  return Math.round(correlation * 100) / 100;
}

/**
 * Determina o tipo de gap para uma área baseado em estudo vs desempenho
 */
export function determineGapType(
  studyPercentage: number,
  accuracy: number
): 'content' | 'activation' | 'balanced' {
  // Gap de conteúdo: muito estudo mas baixa acurácia
  if (studyPercentage > 40 && accuracy < 55) {
    return 'content';
  }
  
  // Oportunidade de ativação: pouco estudo e baixa acurácia
  if (studyPercentage < 30 && accuracy < 55) {
    return 'activation';
  }
  
  // Balanceado: estudo proporcional ao desempenho
  return 'balanced';
}

/**
 * Gera insights automáticos baseados na correlação estudo x desempenho
 */
export function generateCorrelationInsights(
  studyBands: { band: string; avgAccuracy: number; userCount: number }[],
  areaCorrelation: { area: string; studyPercentage: number; accuracy: number; gap: string }[],
  correlationCoefficient: number
): string[] {
  const insights: string[] = [];
  
  // Insight de correlação geral
  if (correlationCoefficient > 0.5) {
    insights.push('📈 Forte correlação positiva: alunos que estudam mais têm melhor desempenho');
  } else if (correlationCoefficient > 0.2) {
    insights.push('📊 Correlação moderada entre estudo e desempenho');
  } else if (correlationCoefficient < 0) {
    insights.push('⚠️ Correlação fraca ou negativa - investigar qualidade do conteúdo');
  }
  
  // Insight de faixas de estudo
  if (studyBands.length >= 2) {
    const lowestBand = studyBands[0];
    const highestBand = studyBands[studyBands.length - 1];
    
    if (highestBand && lowestBand && highestBand.avgAccuracy > lowestBand.avgAccuracy) {
      const diff = highestBand.avgAccuracy - lowestBand.avgAccuracy;
      if (diff > 15) {
        insights.push(`🎯 Alunos com ${highestBand.band} aulas têm +${Math.round(diff)}% de acurácia`);
      }
    }
  }
  
  // Insights de gaps por área
  const contentGaps = areaCorrelation.filter(a => a.gap === 'content');
  const activationGaps = areaCorrelation.filter(a => a.gap === 'activation');
  
  if (contentGaps.length > 0) {
    const area = contentGaps[0].area;
    insights.push(`📚 Gap de conteúdo: ${area} - alto estudo, baixa retenção`);
  }
  
  if (activationGaps.length > 0) {
    const area = activationGaps[0].area;
    insights.push(`🚀 Oportunidade: ${area} - incentivar consumo de aulas`);
  }
  
  // Áreas balanceadas (positivo)
  const balanced = areaCorrelation.filter(a => 
    a.gap === 'balanced' && a.accuracy >= 60 && a.studyPercentage >= 40
  );
  
  if (balanced.length > 0) {
    insights.push(`✅ ${balanced.length} área(s) com bom equilíbrio estudo/desempenho`);
  }
  
  return insights.slice(0, 5); // Máximo 5 insights
}
