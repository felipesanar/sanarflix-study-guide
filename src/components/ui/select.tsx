import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

/**
 * Slot de ícone das primitivas compartilhadas.
 *
 * Mesmo contrato da prop `container` (ver `SelectContentProps`), e pela mesma
 * razão de existir: `select`,
 * `sheet` e `dialog` servem aluno, admin E o Portal do Gestor v2. O gestor exige
 * 100% dos glifos vindos do Fontello do Dendê (handoff §3), enquanto aluno e
 * admin seguem no Lucide. Em vez de trocar a família de ícone para todo mundo —
 * o que mudaria duas experiências que ninguém pediu para mexer —, cada ícone
 * vira um slot OPCIONAL: omitir a prop entrega exatamente o glifo Lucide de
 * hoje, byte por byte; só quem passa a prop (os seis usos do gestor) recebe
 * outro glifo. Ver `features/gestor/components/Icon.tsx`.
 */
type SlotDeIcone = React.ReactNode;

interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  /** Seta do gatilho. Omitido = `ChevronDown` do Lucide (padrão de aluno/admin). */
  icon?: SlotDeIcone;
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, icon, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    {icon === undefined ? (
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    ) : (
      // Sem `asChild`: o `Slot` do Radix clona o filho passando `ref`, e ícone
      // de icon-font é componente de função sem `forwardRef` — o clone dispararia
      // o aviso "Function components cannot be given refs" e perderia o ref.
      // Sem `asChild`, o Radix renderiza seu próprio `<span aria-hidden>`.
      <SelectPrimitive.Icon>{icon}</SelectPrimitive.Icon>
    )}
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

interface SelectScrollUpButtonProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton> {
  /** Seta do botão de rolar para cima. Omitido = `ChevronUp` do Lucide. */
  icon?: SlotDeIcone;
}

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  SelectScrollUpButtonProps
>(({ className, icon, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    {icon ?? <ChevronUp className="h-4 w-4" />}
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

interface SelectScrollDownButtonProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton> {
  /** Seta do botão de rolar para baixo. Omitido = `ChevronDown` do Lucide. */
  icon?: SlotDeIcone;
}

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  SelectScrollDownButtonProps
>(({ className, icon, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    {icon ?? <ChevronDown className="h-4 w-4" />}
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  /**
   * Nó DOM onde o `Portal` do Radix deve montar o popper. Opcional e SEM
   * MUDAR O PADRÃO: quem não passa nada (aluno, admin) cai exatamente onde
   * caía antes — `container` `undefined` é o próprio padrão do Radix
   * (`document.body`, ver `@radix-ui/react-portal`). Existe para o Portal do
   * Gestor v2 ancorar Select dentro de `.gestor-portal`, para que
   * `gestor-theme.css` (tokens `--gp-*` e `prefers-reduced-motion`) alcance
   * o popper — ver `useGestorPortalContainer` em `features/gestor/shell/GestorShell.tsx`.
   */
  container?: HTMLElement | null;
  /**
   * Setas dos botões de rolagem. Ficam aqui, e não no consumidor, porque
   * `SelectScrollUpButton`/`SelectScrollDownButton` são montados internamente:
   * sem repasse, o gestor não teria como alcançá-los. Omitidos = Lucide.
   */
  scrollUpIcon?: SlotDeIcone;
  scrollDownIcon?: SlotDeIcone;
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", container, scrollUpIcon, scrollDownIcon, ...props }, ref) => (
  <SelectPrimitive.Portal container={container}>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton icon={scrollUpIcon} />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton icon={scrollDownIcon} />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  /** Marca de item selecionado. Omitido = `Check` do Lucide. */
  indicatorIcon?: SlotDeIcone;
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, indicatorIcon, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        {indicatorIcon ?? <Check className="h-4 w-4" />}
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
