

# Cadastro sem Semestre + Banner de Onboarding

## Problema
1. O cadastro em lote rejeita usuários sem semestre (validação frontend e backend exigem semestre 1-12)
2. Não existe mecanismo para avisar o usuário que está sem semestre e pedir atualização

## Mudanças

### 1. Edge Function `b2b-create-user` — tornar `semestre` opcional

No schema Zod, mudar `semestre` de obrigatório para opcional (nullable):

```typescript
semestre: z.number().int().min(1).max(12).nullable().optional(),
```

Nos fluxos de create/update, passar `semestre: semestre ?? null` para o banco e metadata.

### 2. Frontend — `UsersTab.tsx` batch validation

Remover a validação que rejeita linhas sem semestre. Se `semestreStr` estiver vazio/ausente, passar `semestre: null` ao invés de rejeitar. Manter validação de range (1-12) apenas quando o valor estiver preenchido.

Na criação unitária, tornar semestre opcional também (não obrigatório no formulário).

### 3. Banner global "Defina seu semestre" — novo componente

Criar `src/components/SemesterPromptBanner.tsx`:
- Verifica `user.semestre` — se `null`/`undefined`, exibe um banner fixo no topo (acima do conteúdo, abaixo do header)
- Banner amarelo/warning com texto: "Seu semestre ainda não foi definido. Defina agora para ver conteúdo personalizado."
- Botão "Definir semestre" abre o `EditProfileSheet`
- Após o usuário definir o semestre e o `forceRefreshProfile` atualizar o context, o banner desaparece automaticamente (sem necessidade de flag localStorage)

### 4. Integrar banner no `Layout.tsx`

Adicionar `<SemesterPromptBanner />` dentro do `<main>` antes de `{children}`, visível apenas quando `user.semestre` é null.

### 5. `EditProfileSheet` — ajuste para semestre null

Quando o semestre é null, o select deve mostrar placeholder "Selecione seu período" sem valor pré-selecionado. O campo nunca fica "locked" se nunca foi definido (pois `semestre_updated_at` será null).

## Arquivos a editar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/b2b-create-user/index.ts` | Tornar `semestre` opcional no schema e fluxos |
| `src/components/admin/UsersTab.tsx` | Remover validação obrigatória de semestre no batch e criação unitária |
| `src/components/SemesterPromptBanner.tsx` | Novo — banner de onboarding |
| `src/components/Layout.tsx` | Integrar banner |

## Segurança
- A coluna `semestre` na tabela `users` já é nullable (`integer | null`)
- O trigger `validate_user_update` não bloqueia definição inicial (cooldown só aplica quando `semestre_updated_at IS NOT NULL`)
- Nenhuma migração SQL necessária

