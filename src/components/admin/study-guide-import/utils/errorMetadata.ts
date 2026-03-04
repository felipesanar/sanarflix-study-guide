/**
 * Error Metadata Catalog
 * Rich metadata for validation errors with user-friendly messages and actions
 */

import {
  Calendar,
  BookOpen,
  Link2,
  Layers,
  Copy,
  FileSpreadsheet,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

export type ErrorSeverity = 'critical' | 'warning' | 'info';

export type ErrorActionType = 'download' | 'navigate' | 'info';

export interface ErrorAction {
  label: string;
  type: ErrorActionType;
  icon?: LucideIcon;
}

export interface ErrorMetadata {
  title: string;
  icon: LucideIcon;
  severity: ErrorSeverity;
  description: string;
  detailedDescription: string;
  actions: ErrorAction[];
  tip?: string;
}

/**
 * Catalog of all known error codes with rich metadata
 */
export const ERROR_METADATA: Record<string, ErrorMetadata> = {
  INVALID_SEMESTRE: {
    title: 'Semestre Vazio ou Inválido',
    icon: Calendar,
    severity: 'critical',
    description: 'O campo semestre é obrigatório e não pode estar vazio.',
    detailedDescription:
      'O campo "semestre" deve conter um número inteiro positivo (ex: 1, 2, 10) ou um texto descritivo (ex: "INTERNATO", "TUTORIA"). Valores vazios não são aceitos.',
    actions: [
      { label: 'Baixar linhas afetadas', type: 'download' },
    ],
    tip: 'Preencha o campo semestre com um número ou um nome descritivo. Semestres textuais serão normalizados para maiúsculas.',
  },

  URL_IN_SEMESTRE: {
    title: 'URL no Campo Semestre',
    icon: AlertTriangle,
    severity: 'critical',
    description: 'O campo semestre contém uma URL, indicando desalinhamento de colunas.',
    detailedDescription:
      'Foi detectada uma URL no campo "semestre". Isso geralmente indica que as colunas do arquivo CSV estão desalinhadas — os dados de link caíram no campo errado. Verifique o delimitador (vírgula, ponto-e-vírgula ou tab) e a ordem das colunas no arquivo.',
    actions: [
      { label: 'Baixar linhas afetadas', type: 'download' },
    ],
    tip: 'Abra o arquivo CSV num editor de texto e verifique se o cabeçalho e os dados usam o mesmo delimitador. Se houver URLs com vírgulas, elas devem estar entre aspas.',
  },

  NEW_SEMESTRE: {
    title: 'Semestre Novo Detectado',
    icon: Calendar,
    severity: 'info',
    description: 'Um semestre que ainda não existe no banco foi encontrado no arquivo.',
    detailedDescription:
      'O semestre informado não existe na base de dados para a IES correspondente. Ele será criado automaticamente durante a importação se aprovado pelo usuário.',
    actions: [
      { label: 'Ver detalhes', type: 'info' },
    ],
    tip: 'Revise se o nome do semestre está correto antes de aprovar a criação.',
  },

  MISSING_MATERIA: {
    title: 'Matéria Obrigatória',
    icon: BookOpen,
    severity: 'critical',
    description: 'O campo matéria é obrigatório e não pode estar vazio.',
    detailedDescription:
      'Cada linha do arquivo deve conter o nome da matéria/disciplina. Linhas sem esse campo não podem ser importadas pois a matéria é a base da organização do guia de estudos.',
    actions: [
      { label: 'Baixar linhas afetadas', type: 'download' },
    ],
    tip: 'Revise o arquivo original e preencha o campo "materia" em todas as linhas. Se uma linha não tem matéria associada, ela provavelmente não deveria existir no arquivo.',
  },

  INVALID_URL: {
    title: 'Link com Formato Incorreto',
    icon: Link2,
    severity: 'warning',
    description: 'Um ou mais links não estão no formato esperado.',
    detailedDescription:
      'Os campos de link (link_aula, link_pdf, link_quiz) devem conter URLs válidas começando com "http://" ou "https://". Links malformados serão ignorados durante a importação.',
    actions: [
      { label: 'Baixar linhas afetadas', type: 'download' },
    ],
    tip: 'Verifique se os links estão completos e começam com "https://". Exemplo: https://exemplo.com/aula.pdf',
  },

  UNMAPPED_SHEET: {
    title: 'Aba Sem IES Vinculada',
    icon: Layers,
    severity: 'critical',
    description: 'Uma ou mais abas do arquivo não estão vinculadas a uma IES.',
    detailedDescription:
      'Cada aba da planilha XLSX precisa estar associada a uma Instituição de Ensino Superior (IES). Sem essa vinculação, não é possível saber para qual instituição os dados devem ser importados.',
    actions: [
      { label: 'Voltar para configuração', type: 'navigate' },
    ],
    tip: 'Volte à etapa de configuração e selecione a IES correspondente para cada aba da planilha.',
  },

  DUPLICATE_ROW: {
    title: 'Linha Duplicada',
    icon: Copy,
    severity: 'warning',
    description: 'Foram encontradas linhas com dados idênticos.',
    detailedDescription:
      'Linhas com a mesma combinação de IES, semestre, matéria, tema, subtema e aula são consideradas duplicatas. No modo MERGE, apenas a primeira ocorrência será considerada.',
    actions: [
      { label: 'Baixar linhas duplicadas', type: 'download' },
    ],
    tip: 'Se as duplicatas forem intencionais (ex: dados diferentes que parecem iguais), revise os campos que diferenciam cada registro.',
  },

  SPARSE_ROW: {
    title: 'Linha com Poucos Dados',
    icon: FileSpreadsheet,
    severity: 'info',
    description: 'Linha contém apenas campos obrigatórios preenchidos.',
    detailedDescription:
      'Esta linha possui apenas os campos obrigatórios (semestre e matéria) mas nenhum conteúdo adicional como tema, subtema, aula ou links. A importação continuará normalmente, mas você pode querer revisar se isso é intencional.',
    actions: [
      { label: 'Ver linhas afetadas', type: 'info' },
    ],
    tip: 'Se os dados estão incompletos propositalmente (ex: estrutura base), ignore este aviso. Caso contrário, preencha os campos adicionais.',
  },

  UNKNOWN: {
    title: 'Erro Desconhecido',
    icon: AlertTriangle,
    severity: 'warning',
    description: 'Um erro não catalogado foi encontrado.',
    detailedDescription:
      'Este tipo de erro não está documentado no sistema. Por favor, revise a mensagem original para mais detalhes.',
    actions: [
      { label: 'Baixar detalhes', type: 'download' },
    ],
    tip: 'Entre em contato com o suporte se este erro persistir.',
  },
};

/**
 * Get metadata for a specific error code
 */
export function getErrorMetadata(code: string): ErrorMetadata {
  return ERROR_METADATA[code] || ERROR_METADATA.UNKNOWN;
}

/**
 * Get severity color classes
 */
export function getSeverityStyles(severity: ErrorSeverity): {
  border: string;
  bg: string;
  text: string;
  badge: string;
} {
  switch (severity) {
    case 'critical':
      return {
        border: 'border-destructive/40',
        bg: 'bg-destructive/5',
        text: 'text-destructive',
        badge: 'bg-destructive/10 text-destructive border-destructive/30',
      };
    case 'warning':
      return {
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/5',
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    case 'info':
    default:
      return {
        border: 'border-blue-500/40',
        bg: 'bg-blue-500/5',
        text: 'text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
  }
}

/**
 * Extract unique invalid values from error messages
 * Looks for quoted strings in messages
 */
export function extractUniqueValues(messages: string[]): string[] {
  const values = new Set<string>();
  
  messages.forEach(msg => {
    // Match quoted values: "value"
    const matches = msg.match(/"([^"]+)"/g);
    if (matches) {
      matches.forEach(match => {
        const value = match.replace(/"/g, '');
        // Filter out long values and common patterns
        if (value.length <= 50 && !value.includes('://')) {
          values.add(value);
        }
      });
    }
  });
  
  return Array.from(values).slice(0, 10);
}

/**
 * Format row numbers for display
 * Shows first few and indicates total
 */
export function formatRowNumbers(rowNumbers: number[], maxShow: number = 5): {
  visible: number[];
  remaining: number;
} {
  return {
    visible: rowNumbers.slice(0, maxShow),
    remaining: Math.max(0, rowNumbers.length - maxShow),
  };
}
