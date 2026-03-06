

# Painel de Desempenho para Professores/Coordenadores

## Contexto

A página atual `SimuladoDesempenho.tsx` mostra dados individuais do aluno logado usando RPCs como `get_user_performance_aggregates` e `get_user_rankings`. Para professores/coordenadores, precisamos de uma visão institucional agregada que mostre o desempenho de **todos os alunos da IES**.

## Arquitetura

A abordagem será criar uma **nova página** `DesempenhoInstitucional.tsx` acessível por professores e admins, com uma nova rota `/desempenho-institucional`. Isso evita sobrecarregar a página existente do aluno e permite lógica/queries independentes.

### Dados necessários (novas RPCs no banco)

Precisamos de **3 novas database functions** para alimentar o painel:

1. **`get_institutional_performance(p_ies_id, p_simulado_id)`** — Retorna desempenho agregado por grande área, especialidade, tema, dificuldade e **segmentação por semestre** para todos os alunos da IES.

2. **`get_institutional_question_details(p_ies_id, p_simulado_id, p_question_tema, p_area, p_specialty)`** — Para o drill-down na árvore hierárquica: retorna questões com gabarito, distribuição de acertos por semestre, e lista de alunos que responderam (nome, semestre, se acertou/errou).

3. **`get_institutional_student_scores(p_ies_id, p_simulado_id)`** — Retorna planilha de desempenho individual: cada aluno com acertos por grande área + score total.

Todas usarão `SECURITY DEFINER` e validarão que o caller tem role `admin`, `professor` ou `coordenador`.

## Visualizações da Página

### 1. Header + Seletor de Simulado
- Select de simulados disponíveis para a IES do professor
- KPIs: total de alunos, acurácia média, questões respondidas

### 2. Segmentação por Semestre (novo)
- Gráfico de barras agrupado mostrando acurácia por semestre
- Cada barra com tooltip mostrando n de alunos e acertos/total

### 3. Árvore Hierárquica Adaptada
- Mesma estrutura (Área → Especialidade → Tema) mas com dados agregados da IES
- Ao clicar num tema, abre modal expandido com:
  - Enunciado da questão e resposta correta
  - Gráfico de distribuição de acertos por semestre
  - Tabela com lista de alunos (nome, semestre, acertou/errou)

### 4. Evolução de Pontuação por Simulado (gráfico de barras)
- Eixo X: simulados (cronológico)
- Barras agrupadas por grande área
- Mostra a evolução da acurácia média da IES ao longo dos simulados

### 5. Planilha de Desempenho Individual
- Tabela com colunas: Aluno | Semestre | [Grande Área 1] | [Grande Área 2] | ... | Score Total
- Cada célula mostra acertos da grande área
- Última coluna: soma total de acertos
- Ordenável por qualquer coluna
- Exportável para CSV/XLSX

## Mudanças em Arquivos

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Criar 3 RPCs: `get_institutional_performance`, `get_institutional_question_details`, `get_institutional_student_scores` |
| **`src/pages/DesempenhoInstitucional.tsx`** | Nova página com todas as 5 visualizações |
| **`src/types/index.ts`** | Adicionar `desempenhoInstitucional` ao `AccessRules` |
| **`src/utils/accessRules.ts`** | Habilitar para admin e professor |
| **`src/hooks/useAccessRules.ts`** | Mapear nova feature key |
| **`src/components/DynamicRoutes.tsx`** | Adicionar rota `/desempenho-institucional` |
| **`src/components/AppSidebar.tsx`** | Adicionar item no menu para professor/admin |

## Segurança

- As RPCs filtram por `id_ies` do professor/admin chamador
- Validação de role (`admin`, `professor`, `coordenador`) dentro de cada RPC
- Nenhum dado de aluno de outra IES é exposto

