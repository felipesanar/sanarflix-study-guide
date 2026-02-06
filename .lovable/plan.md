
# Plano: Correção do Layout da Sidebar

## Problema Identificado

A sidebar está sobrepondo o header e o conteúdo das páginas. Isso ocorre devido a um conflito entre os estilos customizados aplicados no redesign e o sistema de CSS variables do componente `Sidebar` do shadcn/ui.

### Causa Raiz (Técnica)

1. **Classes de largura conflitantes** em `AppSidebar.tsx`:
   - O componente aplica `w-[260px]` e `w-[68px]` diretamente
   - Mas o sistema de sidebar usa CSS variables (`--sidebar-width: min(16rem, 20vw)` = 256px e `--sidebar-width-icon: 3rem` = 48px)
   - O "spacer div" interno do componente `Sidebar` cria espaço baseado nas CSS variables, não nas classes customizadas
   - Resultado: diferença de 4-20px causa sobreposição

2. **Classes redundantes** `hidden md:flex` conflitando com o sistema interno

---

## Solução

Remover as classes de largura customizadas e deixar o sistema de CSS variables do shadcn controlar a largura corretamente.

### Arquivos a Modificar

**1. `src/components/AppSidebar.tsx`**
- Remover as classes `w-[260px]` e `w-[68px]` do className
- Remover `hidden md:flex` (já gerenciado pelo componente base)
- Manter apenas estilos visuais (bg, border, shadow, transition)

```text
ANTES (linhas 161-170):
<Sidebar
  className={`
    hidden md:flex flex-col
    bg-sidebar border-r border-sidebar-border
    shadow-lg dark:shadow-none
    transition-all duration-300
    ${collapsed ? "w-[68px]" : "w-[260px]"}
  `}
  collapsible="icon"
>

DEPOIS:
<Sidebar
  className="bg-sidebar shadow-lg dark:shadow-none transition-all duration-300"
  collapsible="icon"
>
```

---

## Resultado Esperado

- Sidebar desktop respeita o espaçamento correto (256px expandida / 48px colapsada)
- Header e conteúdo principal não são mais sobrepostos
- Comportamento de colapso (`collapsible="icon"`) funciona corretamente
- Sem regressões visuais no design premium implementado

---

## Verificação

Após a correção, testar:
1. Visualizar a Home em desktop (1280px+)
2. Expandir/colapsar a sidebar com o trigger
3. Verificar que não há sobreposição em nenhuma das páginas
4. Confirmar que mobile continua usando MobileHeader + MobileBottomNav (sem sidebar)
