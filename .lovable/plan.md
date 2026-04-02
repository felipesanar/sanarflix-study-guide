

# Geração de Dataset Fictício para "Desempenho Institucional"

## Resumo

Criar um script Python que gera e insere dados fictícios diretamente no Supabase via `psql`, populando todas as tabelas necessárias para que o dashboard funcione completamente com dados realistas. O script será executado uma única vez via `code--exec`.

## Tabelas Envolvidas (Auditoria)

```text
┌─────────────────────┬──────────────────────────────────────────────┐
│ Tabela              │ Uso no Dashboard                             │
├─────────────────────┼──────────────────────────────────────────────┤
│ ies                 │ Dropdown de IES no filtro global             │
│ users               │ Alunos vinculados à IES (id_ies, semestre)   │
│ user_roles          │ Papel 'gestor' para acessar RPCs             │
│ simulados_admin     │ Dropdown de simulados (ies_ids, status)      │
│ questoes_simulado   │ Questões com taxonomia curricular            │
│ answer_progress     │ Respostas dos alunos (correct, user_id)      │
└─────────────────────┴──────────────────────────────────────────────┘
```

Todas as RPCs (`get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution`) fazem JOINs entre `answer_progress → users → questoes_simulado`, filtrando por `id_ies` e `simulado_id`.

## Cenário Fictício

- **IES**: "TESTE_IES Performance Acadêmica" (UUID gerado)
- **3 Simulados**: "TESTE_Simulado 2024.1", "TESTE_Simulado 2024.2", "TESTE_Simulado Diagnóstico"
- **120 alunos** distribuídos nos semestres 1-12
- **~100 questões por simulado** (300 total) com taxonomia hierárquica realista
- **~10.000-15.000 respostas** no `answer_progress`

### Taxonomia Curricular (6 áreas)

```text
Clínica Médica → Cardiologia, Endocrinologia, Pneumologia
                  → 3-5 temas cada
Cirurgia       → Cirurgia Geral, Cirurgia Vascular
                  → 3-4 temas cada
Pediatria      → Neonatologia, Puericultura, Infectologia Pediátrica
                  → 3-4 temas cada (ÁREA CRÍTICA: baixa proficiência)
GO             → Obstetrícia, Ginecologia
                  → 3-4 temas cada
Saúde Coletiva → Epidemiologia, Gestão em Saúde
                  → 2-3 temas cada
Med Preventiva → Atenção Primária, Saúde Mental
                  → 2-3 temas cada (ÁREA FORTE: alta proficiência)
```

### Padrões Analíticos Intencionais

1. **Pediatria**: Proficiência ~35%, prevalência ~18% → quadrante crítico no scatter
2. **Cirurgia**: Proficiência ~45%, prevalência ~15% → zona de atenção
3. **Med Preventiva**: Proficiência ~75%, prevalência ~8% → área forte
4. **Clínica Médica**: Proficiência ~55%, prevalência ~25% → alta prevalência, gap moderado
5. **Distribuição de alunos**: ~25% proficientes, ~45% medianos, ~30% críticos → gera sanção e insights

### Evolução entre Simulados

- Simulado 2024.1: proficiência geral ~42%
- Simulado 2024.2: proficiência geral ~48%
- Simulado Diagnóstico: proficiência geral ~52%

## Implementação

### Script único Python (`/tmp/generate_mock_data.py`)

1. Gera UUIDs para IES, simulados, alunos, questões
2. Cria a IES na tabela `ies`
3. Cria 120 alunos em `auth.users` (via INSERT direto no `users` — não precisa de auth, pois os alunos são fictícios e só precisam existir na tabela `public.users`)
4. Cria 3 simulados em `simulados_admin` com `status='ativo'`, `liberacao_desempenho='imediato'`, `ies_ids` apontando para a IES fictícia
5. Gera ~100 questões por simulado com a taxonomia definida
6. Gera respostas em `answer_progress` com distribuição de performance controlada por perfil de aluno e área
7. Todos os nomes prefixados com "TESTE_"

### Execução

O script gera SQL e executa via `psql`. Dados são inseridos com `ON CONFLICT DO NOTHING` para segurança.

### Validação

Queries de verificação pós-inserção para confirmar contagens.

## Segurança

- Todos os nomes prefixados com "TESTE_"
- UUIDs gerados deterministicamente (seed fixa) para facilitar limpeza futura
- Nenhum dado existente é alterado ou removido
- Nenhuma RPC, tabela ou lógica de cálculo é modificada

## Arquivos Criados/Modificados

- `/tmp/generate_mock_data.py` — script temporário (não persiste no projeto)
- **Nenhum arquivo do projeto é modificado**

