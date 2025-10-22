# Responsividade e Padrões de Layout

Breakpoints
- Mobile: `<768px`
- Tablet: `>=768px` e `<1024px`
- Desktop: `>=1024px`

Grid e Cards (Home)
- Container: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[3fr_2fr]`
- Espaçamento: `gap-4` (mobile 16px), `md:gap-6` (tablet/desktop 24px)
- Altura uniforme: ambos os `Card` com `h-full` e `items-stretch` no grid
- Transições: `transition-all duration-300`

Sidebar
- Mobile: abre como `Sheet` pelo hambúrguer; navegação essencial no footer (bottom bar)
- Tablet: sidebar visível em modo compacto (`collapsible="icon"`), bottom bar oculta
- Desktop: sidebar fixa, com animações suavizadas

Bottom Bar (Mobile)
- Itens: `Início`, `Guia`, `Intensivão`, `Menu`
- Acessibilidade: `aria-label` no `nav` e ícones, estados de foco/ativo
- Safe-area: `pb-[calc(env(safe-area-inset-bottom)+0.5rem)]`

Espaçamentos
- Horizontal entre cards desktop: 24px (`md:gap-6`)
- Vertical entre cards mobile: 16px (`gap-4`)
- Padding interno consistente em `CardHeader`, `CardContent` com escalas responsivas

Imagens
- `loading="lazy"` aplicado ao logo da sidebar
- Evitar layout shift com dimensões definidas

Acessibilidade
- Contraste verificado para temas `dark`/`light`
- Navegação com `NavLink` exibindo estado ativo

Notas
- Ajustes finos podem ser feitos via utilitários Tailwind nos próprios componentes.