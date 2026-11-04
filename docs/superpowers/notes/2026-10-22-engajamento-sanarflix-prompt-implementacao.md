# Prompt de início — implementação do Engajamento SanarFlix (Sonnet 5.5)

Copie o bloco abaixo como primeira mensagem de uma sessão nova do Claude Code aberta em `C:\Users\joao.nader\work\sanarflix-engajamento`.

---

```
Seu papel nesta sessão
Você vai IMPLEMENTAR as telas de Engajamento SanarFlix no SanarFlix Academy, seguindo duas specs já aprovadas. Todas as decisões de produto, de dados e de arquitetura já foram tomadas e estão escritas nelas. Você não decide nada que não esteja lá: quando faltar informação, pare e pergunte ao João.

Leia antes de qualquer ação, inteiros e nesta ordem:
1. docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md — a spec técnica: regras, modelo de dados, SQL de referência, contratos das RPCs, textos literais, cores e consultas de validação.
2. docs/superpowers/plans/2026-10-22-engajamento-sanarflix.md — o plano de tarefas, com passos em checkbox e critérios de aceite.
Não use nenhum outro documento de "mart/arquitetura/engajamento" (inclusive no OneDrive): estão deprecados.

Ordem obrigatória (não negociável)
1. Bloco A — back-end inteiro (A0 → A14): tabelas eng_*, pipeline, cron, as 10 RPCs, testes estáticos de SQL, regeneração de types.
2. Portão A→B — cole no chat o checklist do plano preenchido, com os números das validações V1–V22 ao lado do esperado, e espere o "ok" do João.
3. Bloco B — front-end (B1 → B16), consumindo SÓ as RPCs prontas. Nenhuma tarefa de front cria ou altera tabela, função ou RPC. Se faltar um campo, pare e pergunte.

Regras do projeto
- Ambiente:
  - pasta C:\Users\joao.nader\work\sanarflix-engajamento, branch feat/engajamento-sanarflix;
  - não crie branch nem worktree;
  - nunca commite na main (o Lovable empurra para ela);
  - não toque em C:\Users\joao.nader\work\sanarflix-principal nem nas outras pastas de work\;
  - não use a cópia do OneDrive.
  Comece rodando git status e git log -1 e confirme comigo a branch.
- Supabase de produção: project ref gvqvrmkizemwsasmupmo. Confirme com get_project antes da primeira query. list_tables mente em contagem de linhas: use count(*).
- Migrations:
  - CADA migration precisa do meu "ok" explícito, uma a uma, antes do apply_migration; mostre o SQL antes;
  - rodar o refresh (eng_refresh) em produção também precisa do meu "ok";
  - se o apply_migration for barrado pelo classificador do auto mode, me peça para trocar o modo de permissão; não contorne;
  - depois de aplicar, salve o mesmo SQL em supabase/migrations/<version>_<nome>.sql, com a version de list_migrations;
  - migration aplicada não se edita: correção vai em migration nova.
- Segurança: tabela nova revoga de PUBLIC, anon E authenticated e liga RLS (o default ACL do Supabase dá tudo a anon/authenticated); função interna revoga de PUBLIC, anon e authenticated; RPC revoga de PUBLIC, anon e concede a authenticated. Dados só via RPC SECURITY DEFINER com checagem de IES do gestor (gestor_pode_acessar_ies) ou papel admin. Nenhuma RPC nova usa ies_features/feature flags.
- Types: depois de mudar o schema, regenere src/integrations/supabase/types.ts com generate_typescript_types. Nunca edite à mão.
- Testes:
  - a suíte NÃO está verde: há ~40 falhas pré-existentes (spec §15.1), e a tarefa A0 grava a lista;
  - critério de toda tarefa: nenhuma falha NOVA;
  - lint não é critério;
  - comandos: node node_modules/vitest/vitest.mjs run <caminho> e node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json. npx não resolve nesta pasta.
- Números: o critério é sempre "RPC = consulta de validação na fonte" (spec §14). Se não bater, pare e me mostre a consulta e os dois valores. Nunca ajuste a validação para bater.
- Textos da UI: literalmente os da spec §12. Cores: só os tokens da spec §13 (nenhum hex/rgb no código do gestor).
- IES piloto para validação: PARACATU (d86c32ba-2d09-4c7e-a426-1d981ec7b595). Para chamar RPC como gestor ou admin, simule o JWT como na spec §14 e me pergunte qual usuário usar.
- Commits: um por tarefa, com a mensagem sugerida no plano. Marque os checkboxes do plano no mesmo commit. Push e PR só quando eu pedir.
- Ao fim de cada fase (Bloco A, Portão, Bloco B), liste os próximos passos separados em "Claude" e "João".

Comece pela Tarefa A0.
```
