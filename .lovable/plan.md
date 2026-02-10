

# Plano: Painel de Dados do Guia de Estudos no Admin

## Objetivo

Adicionar um card de resumo/overview acima do wizard de importacao na aba "Guia", mostrando estatisticas do banco de dados sobre os guias de estudos ja cadastrados. Isso permite ao admin ter visibilidade completa antes de subir novos dados.

## O que sera exibido

### Resumo Geral (linha de KPIs)
- Total de registros no banco (ex: 4.641)
- Total de IES com guia cadastrado (ex: 2)
- Total de semestres cobertos
- Total de materias distintas

### Tabela detalhada por IES
Para cada IES que possui dados na tabela `conteudos`:
- Nome da IES
- Quantidade de semestres
- Quantidade de materias
- Quantidade de temas
- Quantidade de aulas
- Total de registros

### Detalhamento expandivel por IES
Ao clicar em uma IES, abre um accordion mostrando a distribuicao por semestre:
- Semestre (1, 2, ..., INTERNATO)
- Qtd materias naquele semestre
- Qtd temas
- Qtd registros

### Cobertura de links
Percentual de registros que possuem:
- Link de aula (video)
- Link de PDF
- Link de quiz

## Secao Tecnica

### Arquivos a criar

**`src/components/admin/study-guide-import/components/StudyGuideOverview.tsx`**
- Componente React que consulta a tabela `conteudos` com JOINs na tabela `ies` para nomes
- Usa 3 queries via Supabase client:
  1. Totais gerais (COUNT, COUNT DISTINCT)
  2. Agrupamento por IES (usando RPC ou query direta)
  3. Agrupamento por IES + semestre (para o accordion)
- Como o Supabase JS client nao suporta GROUP BY nativamente, as queries de agregacao serao feitas via `.from('conteudos').select('*')` com processamento client-side, ou preferencialmente via uma chamada RPC se houver funcao SQL. Dado o volume atual (~4.600 registros), o processamento client-side e viavel e simples.
- Exibe cards de KPI no topo (usando o padrao de MetricCard ja existente no projeto)
- Tabela com dados por IES usando o componente `Table` do shadcn
- Accordion para detalhamento por semestre
- Indicadores de cobertura de links com barras de progresso

### Arquivo a editar

**`src/components/admin/StudyGuideImportTab.tsx`**
- Importar e renderizar `StudyGuideOverview` acima do `StudyGuideImportWizard`
- Separar visualmente com um `Separator`

### Logica de dados (client-side)

```text
1. Buscar todos os registros: supabase.from('conteudos').select('id_ies, semestre, materia, tema, aula, link_aula, link_pdf, link_quiz')
2. Buscar lista de IES: supabase.from('ies').select('id, nome')
3. Agrupar no frontend:
   - Por IES: contar semestres, materias, temas, aulas unicos
   - Por IES+Semestre: contar materias, temas, registros
   - Cobertura: % de registros com link_aula != null, link_pdf != null, link_quiz != null
```

### Componentes UI utilizados
- `Card`, `CardHeader`, `CardTitle`, `CardContent` (shadcn)
- `Table`, `TableHeader`, `TableRow`, `TableCell` (shadcn)
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` (shadcn)
- `Progress` (shadcn) para barras de cobertura
- `Skeleton` para loading state
- Icones do lucide-react: `Database`, `Building2`, `BookOpen`, `GraduationCap`, `Link`, `FileText`, `Video`

