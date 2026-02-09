
# Plano de Melhoria Premium — Navbar Mobile

## Objetivo

Transformar a navegação mobile em uma experiência de classe mundial, com microinterações fluidas, acesso rápido a mais páginas e design visual premium que reforce a identidade da plataforma.

---

## Diagnóstico Atual

### Pontos Fortes
- Glassmorphism implementado corretamente
- Safe area respeitada
- Acessibilidade básica (aria-labels, touch targets ≥ 44px)

### Problemas Identificados

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| Apenas 3 itens + Menu na barra principal | Acesso indireto a páginas importantes | P0 |
| Microinterações fracas (apenas scale no tap) | Experiência não-premium | P1 |
| Item ativo com estilo básico (bg-primary) | Falta de dinamismo visual | P1 |
| Sheet menu genérico | Não guia o usuário | P2 |
| Ausência de feedback háptico visual | Menos responsivo | P2 |

---

## Arquitetura Proposta

### Barra Principal Reformulada

```text
┌─────────────────────────────────────────────────────┐
│  Início   Guia   Simulados   Progresso     ...Menu  │
│    ●       ○        ○           ○             ○     │
└─────────────────────────────────────────────────────┘
```

**Mudanças:**
- **4 itens fixos** + botão Menu (era 3+Menu)
- Adicionar "Progresso" (/dashboard) como item direto para alunos
- Ocultar "Progresso" se usuário não tiver acesso
- Ícone do Menu muda para "X" quando aberto com animação de morphing

### Indicador Ativo Animado

Substituir o background estático por um "pill" animado que desliza entre os itens:

```typescript
// Framer Motion layoutId para pill animado
<motion.div
  layoutId="bottomNavActivePill"
  className="absolute inset-0 bg-primary rounded-2xl shadow-lg"
  transition={{ type: "spring", stiffness: 400, damping: 30 }}
/>
```

### Microinterações Premium

1. **Press State**: `whileTap={{ scale: 0.92, y: 2 }}` — item afunda levemente
2. **Ícone animado**: Ícone do item ativo faz micro-bounce ao entrar
3. **Label fade**: Label aparece apenas no item ativo (economia de espaço)
4. **Ripple visual**: Círculo expandindo do ponto de toque (opcional CSS)

---

## Componentes a Implementar

### 1. NavItem Redesenhado

```typescript
interface BottomNavItem {
  id: string;
  title: string;
  url: string;
  icon: React.ElementType;
  show: boolean;
}

// Renderização com motion.div e pill animado
<NavLink to={item.url}>
  {isActive && (
    <motion.div
      layoutId="activeNavPill"
      className="absolute inset-0 bg-primary rounded-2xl shadow-lg"
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    />
  )}
  <motion.div
    className="relative z-10 flex flex-col items-center"
    whileTap={{ scale: 0.92, y: 1 }}
  >
    <motion.div
      animate={isActive ? { scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.25 }}
    >
      <Icon className={isActive ? "text-primary-foreground" : "text-muted-foreground"} />
    </motion.div>
    <AnimatePresence>
      {isActive && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="text-[10px] text-primary-foreground font-medium"
        >
          {title}
        </motion.span>
      )}
    </AnimatePresence>
  </motion.div>
</NavLink>
```

### 2. Menu Button com Morphing

O botão "Menu" terá animação de ícone:
- Fechado: ☰ (hamburguer)
- Aberto: ✕ (X) com rotação 45°

```typescript
<motion.div
  animate={{ rotate: isMenuOpen ? 45 : 0 }}
  transition={{ duration: 0.2 }}
>
  {isMenuOpen ? <X /> : <Menu />}
</motion.div>
```

### 3. Sheet Menu Aprimorado

- **Header visual**: Avatar do usuário + nome + semestre
- **Seções agrupadas**: "Estudos", "Ferramentas", "Configurações"
- **Quick actions**: Atalhos para ações frequentes (ex: Alterar Tema)
- **Animação de entrada**: Items escalonam com delay progressivo

```typescript
// Stagger animation nos items do menu
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
};
```

---

## Mapeamento de Páginas no Menu

| Seção | Items | Condição |
|-------|-------|----------|
| **Estudos** | Guia de Estudos, Seu Progresso, SanarClass | accessRules |
| **Ferramentas** | Simulados | Sempre visível |
| **Admin** | Portal do Admin, Analytics | isAdmin |
| **Conta** | Alterar Senha, Tema, Semestre Errado, Sair | Sempre |

---

## Especificações Técnicas

### Cores e Estilos

| Elemento | Light Mode | Dark Mode |
|----------|------------|-----------|
| Pill ativo | `bg-primary` | `bg-primary` |
| Ícone ativo | `text-primary-foreground` | `text-primary-foreground` |
| Ícone inativo | `text-muted-foreground` | `text-muted-foreground` |
| Background bar | `bg-background/90 backdrop-blur-xl` | Igual |
| Sombra | `shadow-2xl` | `shadow-none border-t` |

### Animações Tailwind (novas keyframes)

```typescript
// tailwind.config.ts - adicionar
'nav-bounce': {
  '0%, 100%': { transform: 'scale(1)' },
  '50%': { transform: 'scale(1.15)' }
},
'nav-pill-in': {
  '0%': { opacity: '0', transform: 'scale(0.8)' },
  '100%': { opacity: '1', transform: 'scale(1)' }
}
```

### Acessibilidade

- `role="navigation"` na nav
- `aria-current="page"` no item ativo
- `aria-label` descritivo em cada botão
- Touch targets mínimo 48px (aumentado de 44px)
- `prefers-reduced-motion`: desabilitar animações de spring

---

## Fluxo de Implementação

### Fase 1: Reestruturar Items (P0)
1. Expandir `quickNavItems` para 4 items + Menu
2. Adicionar "Progresso" condicionalmente
3. Ajustar layout flex para acomodar 5 elementos

### Fase 2: Pill Animado (P1)
1. Implementar `layoutId="activeNavPill"` com Framer Motion
2. Substituir bg-primary estático por motion.div animado
3. Adicionar shadow dinâmico

### Fase 3: Microinterações (P1)
1. `whileTap` com scale + translateY
2. Bounce no ícone ativo
3. Label condicional com AnimatePresence

### Fase 4: Menu Aprimorado (P2)
1. Redesenhar Sheet com seções
2. Adicionar stagger animation
3. Incluir quick actions (Tema, etc)
4. Morphing icon no botão Menu

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/navigation/MobileBottomNav.tsx` | Refatoração completa |
| `tailwind.config.ts` | Novas keyframes (opcional) |

---

## Preview Visual Esperado

```text
┌───────────────────────────────────────────────────────────────┐
│                        (Conteúdo da página)                   │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│   🏠      📖       📋        📊        ≡                       │
│ Início          [SIMULADOS]                                   │
│   ○       ○      ████████      ○        ○                     │
│                  Simulados                                    │
└───────────────────────────────────────────────────────────────┘
          ▲ Pill animado desliza para o item ativo
```

---

## Checklist de Validação

- [ ] 5 elementos na barra (4 nav + Menu)
- [ ] Pill animado desliza suavemente entre items
- [ ] Ícone do item ativo faz micro-bounce
- [ ] Label aparece apenas no item ativo
- [ ] Menu morphing (hamburguer → X)
- [ ] Sheet com seções organizadas
- [ ] Stagger animation nos items do menu
- [ ] Touch targets ≥ 48px
- [ ] Zero erros no console
- [ ] Funciona em 360px, 390px, 430px
- [ ] Respects prefers-reduced-motion
