
# Plano de Correção: Sistema de Acesso e Descontinuação de Funcionalidades

## Visao Geral

Este plano aborda três grandes áreas de correção:
1. Reestruturação completa do sistema de tipos de usuários e permissões
2. Descontinuação de páginas ENAMED/Intensivos (com arquivamento)
3. Correção de inconsistências identificadas entre código e banco de dados

---

## Parte 1: Reestruturação do Sistema de Usuários

### Tipos de Usuários Finais

| Tipo | Identificacao | Acesso |
|------|---------------|--------|
| **Administrador** | Role `admin` em `user_roles` | Acesso total a tudo (super usuario) |
| **Professor** | Role `professor` em `user_roles` (nova) | A definir futuramente |
| **Aluno B2B** | Vinculado a IES configurada (nao B2C) | Features da sua IES via `ies_features` |
| **Aluno B2C** | Vinculado a IES "B2C" | Removido do fluxo atual |

### Mudancas no accessRules.ts

1. **Remover** constante `B2C_IES_ID` e toda logica B2C
2. **Remover** role `b2b_partner` (nao utilizada no banco)
3. **Remover** logica de "IES nao configurada" - se nao esta configurada, nao tem acesso
4. **Remover** referencias ao ENAMED, Cronograma ENAMED e Intensivos
5. **Simplificar** `isB2BUser` para verificar apenas role `admin`
6. **Admin** passa a ter acesso total sem excecoes

### Mudancas no types/index.ts (AccessRules)

Remover as seguintes chaves do tipo `AccessRules`:
- `enamed`
- `cronogramaEnamed`
- `intensivoUSCS`

---

## Parte 2: Descontinuacao de Paginas

### Criar Estrutura de Arquivo Historico

```text
src/
  _deprecated/
    pages/
      IntensivaoEnamed.tsx
      IntensivoEnamedUSCS.tsx
      CronogramaEnamed.tsx
    services/
      enamedApi.ts
      cronogramaEnamedApi.ts
      intensivoUSCSApi.ts
    README.md (documentacao do que foi arquivado e por que)
```

### Arquivos a Mover para _deprecated

**Paginas:**
- `src/pages/IntensivaoEnamed.tsx`
- `src/pages/IntensivoEnamedUSCS.tsx`
- `src/pages/CronogramaEnamed.tsx`

**Servicos:**
- `src/services/enamedApi.ts`
- `src/services/cronogramaEnamedApi.ts`
- `src/services/intensivoUSCSApi.ts`

**Edge Functions (manter no Supabase mas nao mais utilizadas):**
- `supabase/functions/enamed-proxy/`
- `supabase/functions/cronograma-enamed-proxy/`

### Arquivos a Modificar

**App.tsx:**
- Remover imports lazy de: `IntensivaoEnamed`, `IntensivoEnamedUSCS`, `CronogramaEnamed`
- Remover rotas: `/intensivao-enamed`, `/intensivo-uscs`, `/cronograma-enamed`

**AppSidebar.tsx:**
- Remover itens do menu: "Intensivao ENAMED", "Intensivo ENAMED - USCS", "Cronograma ENAMED"
- Limpar filtros relacionados no render

**config/env.ts:**
- Remover `ENAMED_API_BASE_URL` e `CRONOGRAMA_API_URL`

**hooks/useIntelligentPrefetch.ts:**
- Remover referencias a rotas descontinuadas no `NAVIGATION_PROBABILITIES`
- Remover imports dinamicos dessas rotas

**Componentes compartilhados (avaliar necessidade):**
- `CalendarView.tsx` - usado apenas nas paginas descontinuadas, mover para _deprecated
- `ProgressAreaCard.tsx` - verificar se usado em outros lugares (Dashboard usa)

---

## Parte 3: Correcao de Inconsistencias

### 1. Sincronizar accessRules.ts com ies_features

**Situacao Atual:**
- `accessRules.ts` tem configuracoes hardcoded para cada IES
- Tabela `ies_features` tem configuracoes dinamicas
- Ha duplicacao e potencial conflito

**Solucao:**
- Remover `IES_CONFIG` hardcoded do `accessRules.ts`
- Manter apenas logica de hierarquia (admin > aluno IES)
- Hook `useIesFeatures.ts` ja existe e carrega do banco
- Garantir que todas as IES ativas tenham configuracoes em `ies_features`

### 2. Remover role b2b_partner

**Motivo:** Nao existe nenhum usuario com essa role no banco

**Acoes:**
- Remover do enum `app_role` no banco (migracao)
- Remover referencias no codigo TypeScript
- Atualizar `types.ts` gerado pelo Supabase

### 3. IES sem Configuracao

**IES sem entradas em ies_features:**
- Barao de Maua (d4cce20f-84fa-41f2-935f-d2d7c2284632)
- Claretiano (6029b69d-a2ef-4de5-b907-91f88122bb4e)
- Integrado (72b19e77-c569-4bf7-a433-44563df1015f)

**Solucao:**
- Verificar se essas IES estao ativas
- Se ativas, configurar features basicas
- Se inativas, usuarios dessas IES nao terao acesso a nada alem de simulados

### 4. Usuarios sem IES

**Usuarios identificados:**
- ana@funepe.com (provavelmente deveria ser da Funepe)
- camidoc97@gmail.com (origem desconhecida)

**Solucao:**
- Executar query para corrigir manualmente ou via admin
- Adicionar validacao no login para bloquear usuarios sem IES

---

## Secao Tecnica

### Arquivos Criados

```text
src/_deprecated/README.md
src/_deprecated/pages/IntensivaoEnamed.tsx
src/_deprecated/pages/IntensivoEnamedUSCS.tsx
src/_deprecated/pages/CronogramaEnamed.tsx
src/_deprecated/services/enamedApi.ts
src/_deprecated/services/cronogramaEnamedApi.ts
src/_deprecated/services/intensivoUSCSApi.ts
src/_deprecated/components/CalendarView.tsx (se nao usado em outro lugar)
```

### Arquivos Modificados

| Arquivo | Mudancas |
|---------|----------|
| `src/utils/accessRules.ts` | Remover B2C, b2b_partner, IES_CONFIG, referencias ENAMED |
| `src/types/index.ts` | Remover keys descontinuadas de AccessRules |
| `src/App.tsx` | Remover rotas e imports descontinuados |
| `src/components/AppSidebar.tsx` | Remover itens de menu ENAMED/Intensivos |
| `src/config/env.ts` | Remover URLs ENAMED |
| `src/hooks/useIntelligentPrefetch.ts` | Limpar referencias |
| `src/integrations/supabase/types.ts` | Atualizar enum app_role |

### Arquivos Deletados (do codigo ativo)

- `src/pages/IntensivaoEnamed.tsx`
- `src/pages/IntensivoEnamedUSCS.tsx`
- `src/pages/CronogramaEnamed.tsx`
- `src/services/enamedApi.ts`
- `src/services/cronogramaEnamedApi.ts`
- `src/services/intensivoUSCSApi.ts`

### Migracao de Banco de Dados

```sql
-- Remover features descontinuadas da tabela ies_features
DELETE FROM ies_features 
WHERE feature_key IN ('enamed', 'cronogramaEnamed', 'intensivoUSCS');

-- Opcional: Remover role b2b_partner do enum
-- (requer recriacao do enum, avaliar necessidade)
```

### Validacao Pos-Implementacao

1. Verificar se todas as rotas funcionam corretamente
2. Testar login com diferentes tipos de usuarios:
   - Admin: deve ter acesso total
   - Aluno FAME semestre 0: Home, Guia de Estudos, SanarClass, Dashboard, Simulados
   - Aluno FAME semestre 1+: apenas features configuradas para FAME
   - Aluno de outra IES: features da sua IES
3. Confirmar que paginas descontinuadas nao aparecem em nenhum lugar
4. Confirmar que nao ha erros no console relacionados aos arquivos removidos

---

## Ordem de Execucao Recomendada

1. Criar pasta `_deprecated` e arquivo README
2. Mover arquivos de paginas e servicos para `_deprecated`
3. Atualizar `accessRules.ts` com nova logica simplificada
4. Atualizar `types/index.ts`
5. Limpar `App.tsx` (remover rotas e imports)
6. Limpar `AppSidebar.tsx` (remover itens de menu)
7. Limpar `config/env.ts`
8. Limpar `useIntelligentPrefetch.ts`
9. Avaliar e mover `CalendarView.tsx` se necessario
10. Testar fluxo completo
