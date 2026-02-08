
# Plano: Melhorar Exibicao de Erros no Importador de Guia de Estudos

## Objetivo
Transformar a exibicao de erros de validacao em uma interface mais clara, amigavel e acionavel, permitindo ao usuario entender exatamente o problema e saber o que fazer para corrigi-lo.

## Problemas Atuais
1. Codigos de erro tecnicos (ex: `INVALID_SEMESTRE`) sao pouco amigaveis
2. Mensagens genericas que nao explicam claramente o problema
3. Nao ha orientacoes sobre como corrigir cada tipo de erro
4. Nao ha agrupamento inteligente por tipo de acao necessaria
5. Limitacao de visualizacao (mostra apenas 5 exemplos)

## Solucao Proposta

### 1. Mapa de Erros com Metadados Ricos
Criar um catalogo de tipos de erro com:
- Titulo amigavel em portugues
- Descricao detalhada do problema
- Icone visual apropriado
- Lista de acoes possiveis para correcao
- Nivel de severidade visual

```text
+--------------------------------------------------+
|  Codigo Interno  |  Titulo Amigavel              |
+--------------------------------------------------+
|  INVALID_SEMESTRE | "Semestre Invalido"          |
|  MISSING_MATERIA  | "Materia Obrigatoria"        |
|  INVALID_URL      | "Link com Formato Incorreto" |
|  UNMAPPED_SHEET   | "Aba Sem IES Vinculada"      |
|  DUPLICATE_ROW    | "Linha Duplicada"            |
|  SPARSE_ROW       | "Linha com Poucos Dados"     |
+--------------------------------------------------+
```

### 2. Componente de Erro Expandivel (`ErrorGroupCard`)
Cada categoria de erro sera um card expandivel contendo:
- Header com icone, titulo amigavel, badge de quantidade
- Descricao clara do problema quando expandido
- Lista de linhas afetadas (com scroll interno)
- Secao "O que fazer" com acoes recomendadas
- Valores invalidos encontrados (ex: lista de semestres invalidos unicos)

```text
+-------------------------------------------------------+
| [!] Semestre Invalido                    2.725 linhas |
|     "O campo semestre deve conter um numero"          |
+-------------------------------------------------------+
| EXPANDIDO:                                            |
|                                                       |
| O que esta errado?                                    |
| O campo "semestre" deve conter um numero de 1 a 12,   |
| porem encontramos valores como texto. Valores         |
| invalidos encontrados: INTERNATO, N/A, INTEGRAL.      |
|                                                       |
| Linhas afetadas: 1569, 1570, 1571, 1572... (+2721)    |
|                                                       |
| Como resolver?                                        |
| [Botao] Baixar lista de linhas com erro               |
| [Botao] Editar arquivo original e re-importar         |
|                                                       |
| Dica: Se "INTERNATO" representa o 11o ou 12o          |
| semestre, substitua pelo numero correspondente.       |
+-------------------------------------------------------+
```

### 3. Acoes Disponiveis por Tipo de Erro

Para `INVALID_SEMESTRE`:
- Baixar lista de linhas afetadas
- Sugestao: mapear valores textuais para numeros

Para `MISSING_MATERIA`:
- Baixar lista de linhas sem materia
- Orientar preenchimento obrigatorio

Para `INVALID_URL`:
- Listar URLs malformados
- Mostrar formato esperado (https://...)

Para `UNMAPPED_SHEET`:
- Botao para voltar a etapa de configuracao
- Instrucao para mapear a aba

Para `DUPLICATE_ROW`:
- Informar que duplicatas serao ignoradas automaticamente no modo MERGE
- Opcao de baixar lista para revisao manual

Para `SPARSE_ROW` (aviso):
- Mostrar que a importacao continuara normalmente
- Sugerir revisar se dados estao incompletos intencionalmente

### 4. Download Inteligente de Erros
- Botao por categoria de erro (baixar apenas erros daquele tipo)
- Botao geral para baixar relatorio completo
- CSV com colunas: linha, aba, campo, valor_atual, valor_esperado

### 5. Visual Premium
- Cards com bordas coloridas por severidade
- Animacao suave de expansao/colapso
- Badges com cores: vermelho (critico), amarelo (aviso)
- Scroll area com altura maxima para listas longas
- Valores invalidos destacados com `code` styling

## Arquivos a Modificar

### 1. Novo Arquivo: `errorMetadata.ts`
Catalogo centralizado de metadados de erros com:
- Mapa de codigo para titulo/descricao/acoes
- Funcoes helper para formatar mensagens

### 2. Novo Componente: `ErrorGroupCard.tsx`
Card expandivel para cada categoria de erro:
- Header clicavel para expandir/colapsar
- Secoes internas: descricao, linhas, acoes
- Botoes de acao contextuais

### 3. Atualizar: `ValidationSummary.tsx`
- Substituir lista simples por `ErrorGroupCard`s
- Adicionar logica de extracao de valores unicos invalidos
- Melhorar layout geral

### 4. Atualizar: `parseFile.ts`
- Adicionar campo `invalidValue` ao `ValidationIssue`
- Enriquecer mensagens de erro com mais contexto

## Secao Tecnica

### Estrutura do Catalogo de Erros
```typescript
interface ErrorMetadata {
  title: string;
  icon: LucideIcon;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  actions: ErrorAction[];
  tip?: string;
}

interface ErrorAction {
  label: string;
  type: 'download' | 'navigate' | 'info';
  handler?: (issues: ValidationIssue[]) => void;
}

const ERROR_METADATA: Record<string, ErrorMetadata> = {
  INVALID_SEMESTRE: {
    title: 'Semestre Invalido',
    icon: Calendar,
    severity: 'critical',
    description: 'O campo semestre deve conter um numero de 1 a 12.',
    actions: [
      { label: 'Baixar linhas afetadas', type: 'download' },
    ],
    tip: 'Se o arquivo usa nomes como "INTERNATO", substitua pelo numero do semestre correspondente (ex: 11 ou 12).'
  },
  // ... outros erros
};
```

### Extracao de Valores Unicos
```typescript
const uniqueInvalidValues = useMemo(() => {
  const values = new Set<string>();
  issues.forEach(issue => {
    const match = issue.message.match(/"([^"]+)"/);
    if (match) values.add(match[1]);
  });
  return Array.from(values).slice(0, 10);
}, [issues]);
```

## Entregaveis
1. Catalogo de metadados de erros (`errorMetadata.ts`)
2. Componente `ErrorGroupCard.tsx` com UI premium
3. `ValidationSummary.tsx` atualizado
4. Funcao de download por categoria de erro
5. Campos enriquecidos no `ValidationIssue`

## Beneficios
- Usuario entende imediatamente o que esta errado
- Acoes claras e contextuais para cada tipo de erro
- Visual premium e profissional
- Reducao de duvidas e tickets de suporte
- Fluxo de correcao guiado passo a passo
