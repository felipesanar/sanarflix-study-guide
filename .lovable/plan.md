
# Plano: Alterar Destino Padrao de Login para Home

## Objetivo
Alterar o redirecionamento pos-login de `/simulados` para `/home`, respeitando as regras de acesso do usuario.

---

## Alteracoes Necessarias

### 1. LoginForm.tsx (src/components/LoginForm.tsx)

**Problema atual:**
- Linha 40: `const target = "/simulados";` esta hardcoded

**Solucao:**
Usar `getAccessRules` para determinar o destino correto:

```tsx
// Linhas 37-44
if (success) {
  setTimeout(() => {
    // Determinar destino baseado nas permissoes do usuario
    const rules = getAccessRules(/* user from context */);
    const target = rules.home ? "/home" : "/simulados";
    Logger.info('post_login_navigation', { target });
    navigate(target, { replace: true });
  }, 50);
}
```

**Nota:** O usuario ja esta disponivel no contexto apos login bem-sucedido, porem o state pode nao ter atualizado ainda. A solucao mais simples e navegar para `/home` e deixar a rota tratar o fallback (ja implementado em App.tsx linha 132).

**Implementacao simplificada:**
```tsx
// Linhas 39-42
setTimeout(() => {
  const target = "/home";
  Logger.info('post_login_navigation', { target });
  navigate(target, { replace: true });
}, 50);
```

### 2. App.tsx (src/App.tsx)

**Problema atual:**
- Linhas 102-104: `getDefaultRoute()` sempre retorna `/simulados`

**Solucao:**
Usar `accessRules` ja disponivel no escopo para determinar a rota correta:

```tsx
// Linhas 101-105
const getDefaultRoute = () => {
  // Priorizar Home se usuario tiver acesso
  return accessRules.home ? "/home" : "/simulados";
};
```

---

## Fluxo Apos Alteracoes

```
Usuario faz login
       |
       v
Navigate para /home
       |
       v
+-- Tem accessRules.home? --+
|                           |
Sim                        Nao
|                           |
v                           v
Renderiza Home        Redireciona para /simulados
                      (linha 132 do App.tsx)
```

---

## Arquivos Modificados

| Arquivo | Linhas | Alteracao |
|---------|--------|-----------|
| `src/components/LoginForm.tsx` | 40 | Mudar target de `/simulados` para `/home` |
| `src/App.tsx` | 103 | Retornar `/home` se `accessRules.home`, senao `/simulados` |

---

## Secao Tecnica

### Por que navegar direto para /home mesmo sem verificar permissoes no LoginForm?
O App.tsx ja possui logica de fallback (linha 132): se o usuario nao tem acesso a Home, ele e automaticamente redirecionado para /simulados. Isso evita duplicar a logica de verificacao de permissoes.

### Comportamento esperado por tipo de usuario:
- **Admin:** Acesso total → vai para `/home`
- **Professor:** `accessRules.home = true` → vai para `/home`
- **Aluno B2B:** Depende de `ies_features` → `/home` ou `/simulados`
- **Aluno sem IES configurada:** `accessRules.home = false` → vai para `/simulados`

### Compatibilidade
- Nenhuma dependencia adicional
- Usa estrutura de permissoes existente
- Fallback automatico ja implementado
