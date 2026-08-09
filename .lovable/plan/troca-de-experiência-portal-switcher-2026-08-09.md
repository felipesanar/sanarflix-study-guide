# Troca de experiência (portal switcher)

A sidebar do aluno volta a ser só do aluno. "Portal do Admin" e "Desempenho Institucional" deixam de ser itens de menu e passam a ser **troca de experiência**, num controle único e consistente nos três portais.

## Decisão de UX

Um único componente novo — **Alternador de experiência** — colocado no topo da sidebar, logo abaixo da marca (antes do cartão do usuário):

```text
┌──────────────────────────────┐
│  ●  Academy                  │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ 🎓 Aluno            ⌄    │ │  <- alternador (só aparece p/ quem tem 2+)
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  FS  Felipe Souza      ⚙     │
│  MENU PRINCIPAL              │
│  Início / Guia / ... (aluno) │
└──────────────────────────────┘
```

Ao clicar, abre um menu com as experiências disponíveis, cada uma com ícone, nome e uma linha de descrição, e um check na atual:

- Aluno — "Estudos, simulados e progresso" → `/`
- Gestão — "Desempenho institucional da sua IES" → `/gestor`
- Admin — "Administração da plataforma" → `/admin`
- Atendimento — "Suporte a usuários" → `/atendimento/usuarios`

Regras:
- O alternador só aparece para quem tem mais de uma experiência; quem só é aluno não vê nada novo (sidebar limpa, sem elemento morto).
- Rótulo do gatilho = experiência **atual**, para deixar claro "onde estou".
- Mobile: o mesmo alternador entra no topo do sheet do menu (`MobileBottomNav`), substituindo a seção "Gestão"; a barra inferior continua 100% aluno.
- Nos portais Admin/CX e Gestor, o alternador substitui os botões avulsos ("Ir para versão aluno", "Portal do Admin", troca Admin↔CX), mantendo o mesmo formato e posição relativa (rodapé da sidebar daqueles shells, onde hoje vivem esses botões).

## Mudanças técnicas

- Novo `src/experiences/shared/ExperienceSwitcher.tsx`: usa `useAuth().access` + `hasExperience`, lista derivada de um novo `getExperienceOptions(access)` em `src/experiences/shared/globalNav.ts` (id, rótulo, descrição, ícone, entrypoint de `EXPERIENCE_ENTRYPOINTS`), detecção da experiência atual pelo `pathname`. Radix `DropdownMenu`, tokens semânticos, teclado/ARIA (`aria-current`, foco visível).
- `src/components/AppSidebar.tsx`: remover `getPortalEntries` do menu (`visibleMenuItems` volta a ser só `studentItems`) e montar o alternador no header. Versão colapsada: só o ícone da experiência atual, com tooltip.
- `src/components/navigation/MobileBottomNav.tsx`: remover a seção "Gestão" do sheet e inserir o alternador no topo do sheet.
- `src/experiences/admin/AdminLayout.tsx`: trocar `GoToStudentButton` + botão de troca Admin/CX pelo alternador.
- `src/features/gestor/shell/GestorShell.tsx`: trocar o botão "Portal do Admin" + `GoToStudentButton` pelo alternador, estilizado com os tokens `--gp-*` do tema do gestor (variante compacta).
- `getPortalEntries` e `GoToStudentButton` ficam sem uso: remover ambos junto com `src/test/unit/globalNav.test.ts` (substituído por teste do novo `getExperienceOptions`) e ajustar testes que os referenciam.
- Testes: cobrir "aluno puro não vê alternador", "admin vê as opções e a atual marcada", "sidebar do aluno não contém mais 'Portal do Admin'/'Desempenho Institucional'".
