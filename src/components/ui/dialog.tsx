import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Nó DOM onde o `Portal` do Radix deve montar o conteúdo (overlay + painel).
   * Opcional e SEM MUDAR O PADRÃO: quem não passa nada (aluno, admin) cai
   * exatamente onde caía antes — `container` `undefined` é o próprio padrão
   * do Radix (`document.body`, ver `@radix-ui/react-portal`). Existe para o
   * Portal do Gestor v2 ancorar Dialog dentro de `.gestor-portal`, para que
   * `gestor-theme.css` (tokens `--gp-*` e `prefers-reduced-motion`) alcance
   * o conteúdo — ver `useGestorPortalContainer` em `features/gestor/shell/GestorShell.tsx`.
   */
  container?: HTMLElement | null;
  /**
   * Glifo do botão de fechar. Mesmo contrato de `container`: omitir entrega
   * exatamente o `X` do Lucide de hoje, então aluno e admin não mudam. O Portal
   * do Gestor v2 exige 100% dos ícones vindos do Fontello do Dendê (handoff §3)
   * e injeta `<Icon name="close" size={16} />` por aqui.
   */
  closeIcon?: React.ReactNode;
  /**
   * Rótulo do botão de fechar para leitor de tela. O default segue "Close"
   * porque é o que aluno e admin anunciam hoje; o portal do gestor é todo em
   * pt-BR (handoff docs/11-acessibilidade.md) e passa "Fechar".
   */
  closeLabel?: string;
  /**
   * Classes extras do alvo de fechar. O gestor pede um alvo de 30×30 com borda
   * e raio 8px (handoff §4.5):
   * `"inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px]
   *   border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"`.
   * Sem a prop, o alvo continua sendo o quadrado nu do shadcn.
   */
  closeClassName?: string;
  /**
   * Classes extras do scrim. Existe porque o overlay é montado aqui dentro e o
   * consumidor não tem outra forma de alcançá-lo. O default `bg-black/80` fica
   * para aluno/admin; o gestor passa `bg-[var(--gp-scrim)]`, e o
   * `tailwind-merge` do `cn` resolve o conflito de background.
   */
  overlayClassName?: string;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({
  className,
  children,
  container,
  closeIcon,
  closeLabel = "Close",
  closeClassName,
  overlayClassName,
  ...props
}, ref) => (
  <DialogPortal container={container}>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
          closeClassName
        )}
      >
        {closeIcon ?? <X className="h-4 w-4" />}
        <span className="sr-only">{closeLabel}</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
