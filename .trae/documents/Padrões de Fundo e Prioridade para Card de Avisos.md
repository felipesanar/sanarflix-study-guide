## Objetivo
- Definir 5 padrões de fundos vívidos, selecionáveis no portal do admin, com contraste perfeito em claro/escuro para título, descrição e botão.
- Tornar `svg` e o bloco de ícone (`div`) mais chamativos conforme a prioridade do aviso; no nível mais alto, ícone totalmente preenchido e um efeito leve de alerta, mantendo acessibilidade.

## Padrões de Fundo (Gradientes + Tokens)
- Flame (vermelho)
  - Fundo: `bg-gradient-to-br from-red-600 via-red-500 to-orange-500`
  - Overlay/escuro: `dark:from-red-700 dark:via-red-600 dark:to-orange-600`
  - Textos: `text-white`/`dark:text-white` com sombra sutil para legibilidade
- Emerald (verde)
  - Fundo: `bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500`
  - Overlay/escuro: `dark:from-emerald-700 dark:via-emerald-600 dark:to-teal-600`
  - Textos: `text-white`/`dark:text-white`
- Royal (azul)
  - Fundo: `bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600`
  - Overlay/escuro: `dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700`
  - Textos: `text-white`/`dark:text-white`
- Sunset (laranja/rosa)
  - Fundo: `bg-gradient-to-br from-orange-500 via-pink-500 to-rose-500`
  - Overlay/escuro: `dark:from-orange-600 dark:via-pink-600 dark:to-rose-600`
  - Textos: `text-white`/`dark:text-white`
- Amethyst (roxo)
  - Fundo: `bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600`
  - Overlay/escuro: `dark:from-violet-700 dark:via-purple-700 dark:to-fuchsia-700`
  - Textos: `text-white`/`dark:text-white`

Observações técnicas:
- Para garantir contraste AAA/AA, aplicar um leve `bg-black/10 dark:bg-black/15` overlay por trás dos textos se necessário e `drop-shadow` discreto.
- Botão: usar `bg-card/70` com `hover:bg-card/90` e borda `border-border/40` para manter contraste sobre gradiente.

## Priorização (Visual do Ícone e Bloco)
- Prioridades: baixa, média, alta, crítica
- Ícone (`svg`):
  - Baixa: `stroke-current` (contorno), cor tema correspondente
  - Média: `stroke-current` + `fill-current/20`
  - Alta: `fill-current/50` + glow suave
  - Crítica: `fill-current` total + pulso leve (`animate-pulse` custom) e `ring-2 ring-white/30 dark:ring-black/30`
- Bloco do ícone (`div`):
  - Ajustar fundo do bloco para maior vividez: `from-<cor>/40 via-<cor>/25 to-<cor>/15`
  - Crítica: adicionar `shadow-[0_0_30px_rgba(255,255,255,0.15)] dark:shadow-[0_0_30px_rgba(0,0,0,0.25)]`
- Acessibilidade: respeitar `prefers-reduced-motion`; desabilitar animações e usar apenas estado sólido.

## Admin (Portal)
- Campos no editor de aviso:
  - `backgroundStyle`: enum (`flame`, `emerald`, `royal`, `sunset`, `amethyst`)
  - `priority`: enum (`low`, `medium`, `high`, `critical`)
  - Preview em tempo real com claro/escuro
- Persistência: salvar no schema dos anúncios (`style.background`, `style.priority`), sem quebrar compatibilidade.

## Implementação
1) Mapas de estilo
- Criar `ANNOUNCEMENT_STYLES` com classes Tailwind por padrão (gradiente + overlay + tipografia) e `PRIORITY_STYLES` para `svg`/bloco de ícone.
- Função `getAnnouncementClasses(style, priority, theme)` retornando classes combinadas.
2) Componente `AnnouncementsCard`
- Aplicar classes do `ANNOUNCEMENT_STYLES[style]` na raiz do card.
- Aplicar `PRIORITY_STYLES[priority]` em ícone e container.
- Botão com variações de contraste: `variant="secondary"` + override de cores conforme fundo.
3) Admin
- Atualizar `AnnouncementEditor` com dois `Select` e preview.
- Validar valores; default `flame` + `medium`.
4) Acessibilidade
- Contraste: usar `text-white`/`text-foreground` dinâmico e overlay para manter legibilidade.
- Reduzir movimento se `prefers-reduced-motion`.

## Testes
- Unitários (Vitest):
  - Mapeamento de estilos para cada `backgroundStyle`/`priority` retorna classes esperadas.
  - `prefers-reduced-motion` desativa animações.
- Integração (Playwright):
  - Card renderiza com bom contraste em claro/escuro.
  - Ícone e bloco mudam conforme prioridade.
  - Preview no admin reflete seleção e persiste.

## Entregáveis
- 5 padrões de fundo com alta vividez e contraste em claro/escuro.
- Prioridade com ícone preenchido e alerta leve no estado crítico.
- Editor no admin com seleção de fundo e prioridade + preview.
- Testes unitários e integração cobrindo estilos e acessibilidade.

## Observações
- Manter identidade visual com paleta já usada, ajustando saturação/brightness via gradientes.
- Evitar cores de botão que conflitem com o gradiente; usar `bg-card`/`bg-background` para o CTA e `text-primary` no label.
- Documentar tokens para evoluções futuras de tema.