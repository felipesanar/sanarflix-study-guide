
# Plano: Integrar useAccessRules no App.tsx para Controle Dinamico de Rotas

## Diagnostico do Problema

O sistema de IES Features permite que administradores ativem/desativem funcionalidades por instituicao atraves do painel admin. Entretanto, apenas a **sidebar** respeita essas configuracoes dinamicas porque usa o hook `useAccessRules`. 

O **roteamento** em `App.tsx` ainda usa `getAccessRules(user)` diretamente, que retorna regras **estaticas** do arquivo `accessRules.ts`. Isso faz com que:

1. O item "Inicio" apareca na sidebar (correto - usa hook dinamico)
2. Ao clicar, o usuario seja redirecionado para `/simulados` (errado - rota usa regras estaticas)

### Fluxo Atual (Problematico)

```text
Usuario clica em "Inicio" na sidebar
         |
         v
App.tsx verifica accessRules.home
         |
         v
getAccessRules() retorna regras ESTATICAS (home: false para alunos B2B)
         |
         v
Rota condicional: accessRules.home ? <Home /> : <Navigate to="/simulados" />
         |
         v
Usuario eh redirecionado para /simulados
```

### Fluxo Esperado

```text
Usuario clica em "Inicio" na sidebar
         |
         v
App.tsx verifica accessRules.home via useAccessRules()
         |
         v
Hook consulta tabela ies_features no banco
         |
         v
Se feature "home" habilitada para IES do usuario -> mostra <Home />
         |
         v
Usuario acessa a Home normalmente
```

---

## Solucao Proposta

### 1. Criar Componente de Rotas Dinamicas

Extrair a logica de rotas para um componente separado que pode usar hooks React:

**Arquivo**: `src/components/DynamicRoutes.tsx`

Este componente:
- Usa `useAccessRules()` para obter permissoes dinamicas
- Exibe loading state enquanto features carregam do banco
- Define rotas condicionais baseadas nas features dinamicas

### 2. Atualizar App.tsx

Substituir o bloco de rotas atual pelo novo componente `DynamicRoutes`, mantendo a estrutura do `AppContent` mas delegando a renderizacao de rotas.

### 3. Garantir Loading State Adequado

Durante o carregamento das features:
- Mostrar skeleton/loading
- Evitar "flash" de redirecionamento incorreto
- Somente avaliar permissoes apos features carregarem

---

## Alteracoes por Arquivo

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/DynamicRoutes.tsx` | **NOVO** - Componente que usa useAccessRules e define rotas dinamicamente |
| `src/App.tsx` | Substituir logica de rotas por DynamicRoutes, remover getAccessRules direto |

---

## Secao Tecnica

### Estrutura do DynamicRoutes.tsx

```tsx
// src/components/DynamicRoutes.tsx
import { useAccessRules } from '@/hooks/useAccessRules';

export const DynamicRoutes: React.FC = () => {
  const { accessRules, loading } = useAccessRules();

  // Aguardar carregamento das features antes de decidir rotas
  if (loading) {
    return <LoadingSkeleton />;
  }

  const getDefaultRoute = () => {
    return accessRules.home ? "/home" : "/simulados";
  };

  return (
    <Routes>
      {/* Rotas condicionais baseadas em accessRules dinamico */}
      {accessRules.home ? (
        <Route path="/home" element={<Home />} />
      ) : (
        <Route path="/home" element={<Navigate to="/simulados" replace />} />
      )}
      {/* ... outras rotas ... */}
    </Routes>
  );
};
```

### Padrao de Verificacao de Loading

O ponto critico eh garantir que as rotas **nao sejam avaliadas** enquanto as features estao carregando. Isso evita o "flash" de redirecionamento incorreto:

```tsx
// ERRADO - Avalia rotas antes de features carregarem
const { accessRules } = useAccessRules();
// accessRules.home pode ser false durante loading

// CORRETO - Espera loading terminar
const { accessRules, loading } = useAccessRules();
if (loading) return <Skeleton />;
// Agora accessRules.home tem o valor correto do banco
```

### Hierarquia de Permissoes Mantida

1. **Admin**: Acesso total (nao usa ies_features)
2. **Professor**: Regras de professor (nao usa ies_features) 
3. **Aluno B2B**: Features dinamicas da tabela `ies_features`

### Impacto nas Outras Rotas

Todas as rotas condicionais em App.tsx serao atualizadas:
- `/home` - Controlado por `accessRules.home`
- `/guia-estudos` - Controlado por `accessRules.studyGuide`
- `/dashboard` - Controlado por `accessRules.dashboard`
- `/gestao-usuarios` - Controlado por `accessRules.userManagement`
- `/desempenho-simulado` - Controlado por `accessRules.SimuladoDesempenho`

### Testes Recomendados

Apos implementacao:
1. Login com usuario do Claretiano com Home ativada via admin
2. Verificar que sidebar mostra "Inicio"
3. Clicar em "Inicio" e confirmar acesso a pagina Home
4. Login com usuario de IES sem Home ativada
5. Confirmar que "Inicio" nao aparece na sidebar
6. Acessar /home diretamente via URL e confirmar redirect para /simulados
