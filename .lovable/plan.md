# Diagnóstico — Alice Miguel (FAI) sem acesso ao Desempenho do Simulado

## O que encontrei no banco

**Usuária:**
- Nome: `Alice Miguel`
- Email: `alicemiguel@fai.com.br` (sem ponto — a Ju digitou `alice.miguel@fai.com.br` no Slack, mas não existe esse email no banco)
- ID: `6dfa5f73-8d32-41b3-a845-d77e5e131a02`
- IES: FAI (`2c458bcb-98f0-4dc2-8b43-298e85298845`) ✅
- Semestre: 11
- **Roles em `user_roles`: NENHUMA** ❌

**Por isso ela não vê o Desempenho do Simulado:**
1. No frontend, `getAccessRules` (sem role) retorna `desempenhoInstitucional: false` → o item de menu nem aparece.
2. As RLS de `resultados_ies_tri`, `resultados_alunos_tri`, `simulados_admin`, `answer_progress` e `questoes_simulado` exigem `gestor`, `professor`, `b2b_partner` ou `admin`. Sem role, ela é tratada como aluna comum.

## Bug colateral grave (descoberto na investigação)

Os **6 outros docentes/coordenadores da FAI** (Alessandro/coordmed, Estevão/proensino, João Vitor Nader, Osmar, Sérgio, Valter) estão todos com a role `gestor_formal`. Mas:

- A memória `mem://constraints/gestor-formal-excluido-do-desempenho-institucional` já documenta que `gestor_formal` é **excluído** das RPCs/RLS institucionais.
- Em `accessRules.ts`, `isGestor()` aceita `gestor_formal` e libera `desempenhoInstitucional` no menu — mas as RLS do banco bloqueiam o acesso real aos dados.

→ Provavelmente todos esses 6 docentes vivem o mesmo problema da Alice (veem a tela vazia ou erro de permissão). É a mesma queixa recorrente.

## Plano

### 1. Liberar acesso da Alice Miguel (correção pontual)

Migration aditiva para atribuir a role `gestor` (não `gestor_formal`, que está bloqueada por RLS):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('6dfa5f73-8d32-41b3-a845-d77e5e131a02', 'gestor')
ON CONFLICT (user_id, role) DO NOTHING;
```

Após isso ela passa a ver o item "Desempenho Institucional" no menu e os dados da FAI carregam normalmente (RLS ok).

### 2. Corrigir bug estrutural dos `gestor_formal` (correção global)

Duas opções (escolha sua):

- **(A) Promover todos os `gestor_formal` para `gestor`** — uma única migration aditiva (`INSERT … SELECT user_id, 'gestor' FROM user_roles WHERE role = 'gestor_formal' ON CONFLICT DO NOTHING`). Mantém `gestor_formal` para auditoria, mas garante acesso real. Resolve FAI inteira e qualquer outra IES afetada.
- **(B) Incluir `gestor_formal` nas RLS institucionais** — alterar policies de `resultados_ies_tri`, `resultados_alunos_tri`, `simulados_admin`, `answer_progress`, `questoes_simulado` para aceitar `gestor_formal` também. Mais invasivo, contraria a memória existente, e exige reescrever várias RPCs.

Recomendo **(A)**: é aditivo, reversível, não toca em RLS/RPC, e alinha com a memória atual. Também alinha o frontend (que já trata os dois como gestores no menu).

### 3. Não-mexer

- Não há mudança em código frontend necessária.
- Não há alteração em RLS.
- Nenhum dado é deletado (todas as operações são `INSERT … ON CONFLICT DO NOTHING`).

## Perguntas antes de migrar

1. Confirma que o email correto é `alicemiguel@fai.com.br` (sem ponto)?
2. Quer apenas a correção pontual da Alice (passo 1) ou já incluo a correção global dos 6 `gestor_formal` da FAI (passo 2A)?
3. Se incluir o passo 2A, aplico **só na FAI** ou em **todas as IES** que tenham `gestor_formal`?
