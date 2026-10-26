# Página do Mentor · proposta de pré-produção (26/10/2026)

Objetivo: o Léo validar a Página do Mentor num endereço web, sem publicar o front em `academy.sanar.com.br`
e sem depender do `localhost:8080` do Felipe. Proposta, nada executado.

## Como está hoje

- O front do Academy é o projeto Lovable **SanarFlix Academy** (`0567bb51-c70e-4f66-a5f1-67d7783d65ce`),
  publicado a partir da `main` do GitHub (`felipesanar/sanarflix-study-guide`). O Lovable continua editando a
  `main` (commits de 16, 21 e 23/10 no importador de respostas).
- Não há deploy na Vercel ligado ao repositório: a API de deployments do GitHub está vazia e o único check nos
  commits é o GitHub Actions. O `vercel.json` só define headers.
- O cliente Supabase aponta fixo para produção (`src/integrations/supabase/client.ts`,
  `gvqvrmkizemwsasmupmo`). **Qualquer pré-prod do front lê e escreve no banco de produção**, igual ao
  `localhost` de hoje. O backend do mentor já está todo lá.
- Só existe 1 mentor cadastrado (a conta de teste da turma "Carcará", 31 vínculos, alunos reais).

## Opções

| | Como | A favor | Contra |
|---|---|---|---|
| **A. Preview da branch na Vercel** (recomendada) | Projeto Vercel novo, importando o repo; build `vite build`, saída `dist`; deploy de preview a cada push da `feat/mentor-fundacao`; proteção por senha ou Vercel Authentication ligada | URL estável por branch, não toca o Lovable nem a `main`, desligável a qualquer hora | Precisa de push da branch (hoje proibido nesta sessão), de uma conta/time Vercel e de rewrite SPA |
| B. Trocar o branch do Lovable | Apontar o projeto Lovable para `feat/mentor-fundacao` | Usa o preview do Lovable que já existe | O Lovable passaria a editar a branch para todo mundo; quem mexe no importador na `main` perderia o lugar. Descartar |
| C. Merge na `main` com o portal só para o papel mentor | O `/mentor` já só abre para quem tem papel mentor (1 conta) | Zero infraestrutura | É publicar em produção, contra a decisão de 15/10 de não publicar o front atual. Fica para depois do redesenho |

## Passo a passo da opção A

1. Felipe autoriza o push da `feat/mentor-fundacao` (já existe no GitHub em `137333d6`; falta o merge com a
   `main` e o commit de questões desta sessão).
2. Na Vercel: Add New Project → importar `felipesanar/sanarflix-study-guide` → Framework Vite → Build
   `npm run build` (ou `bun run build`), Output `dist`. Production Branch: um nome que não exista (ex.:
   `vercel-prod-desligado`), para que só existam previews.
3. Acrescentar ao `vercel.json` o rewrite de SPA (`{"source": "/(.*)", "destination": "/index.html"}`), senão
   `/mentor/turma` dá 404 no refresh. Hoje ele não tem `rewrites`.
4. Ligar a proteção de deploy (Vercel Authentication ou senha) para o preview não ficar público.
5. Supabase Auth (`gvqv`) → URL Configuration: acrescentar o domínio do preview às Redirect URLs. O login por
   senha funciona sem isso; recuperar senha e convite precisam.
6. Aplicar antes a migration `20261026150000_mentoria_questoes_b2b.sql` (questões B2B), pelo roteiro de sempre
   (functiondef, BEGIN/ROLLBACK, advisors). Sem ela o preview mostra "–" em questões.
7. Mandar ao Léo o link e como entrar (ver o ponto 2 abaixo).

## Decisões que o Felipe precisa tomar

1. **Push e Vercel**: autorizar o push e quem cria o projeto Vercel (conta pessoal ou time da Sanar).
2. **Com que conta o Léo entra.** O portal mostra a turma do mentor logado. Hoje a única turma é a da conta de
   teste. Opções: (a) o Léo entra com a conta de teste numa call com o Felipe; (b) criar um mentor para o Léo em
   `/admin/mentores` com alguns alunos de teste. A opção (b) mexe em vínculos novos, não nos 31 da Carcará.
3. **Cuidado na validação:** o banco é produção e os alunos da Carcará são reais. Publicar no mural, liberar
   agenda ou criar sessão grava de verdade. O aluno ainda não vê nada, porque a `mentoria-api` não foi publicada.
   Ainda assim, combinar com o Léo que a validação é de leitura, ou limpar depois.
4. A decisão de arquitetura do Papo de Quinta (o back do Flix ser dono de mural, sessões, mentores e tribos)
   não muda a pré-prod. Mudaria só de onde vêm mural e sessões, que o Léo verá com o modelo atual.
