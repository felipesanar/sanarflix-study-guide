import React from "react";
import { NavLink } from "react-router-dom";
import { motion, LayoutGroup } from "framer-motion";
import { ChevronDown, LucideIcon } from "lucide-react";
import {
  SidebarMenuItem as ShadcnSidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MenuItemData {
  title: string;
  url: string;
  /** Componente de ícone (Lucide ou compatível) — renderizado como <Icon className=…>. */
  icon?: LucideIcon | React.ElementType;
  description?: string;
  /** Contador opcional (ex.: itens devidos no caderno) exibido como pill/ponto. */
  badge?: number;
}

interface SidebarNavItemProps {
  item: MenuItemData;
  isActive: boolean;
  collapsed?: boolean;
}

export function SidebarNavItem({ item, isActive, collapsed }: SidebarNavItemProps) {
  const Icon = item.icon ?? (() => null);

  const content = (
    <NavLink
      to={item.url}
      end
      aria-current={isActive ? "page" : undefined}
      className={`
        group relative flex items-center gap-3 py-2.5
        rounded-xl
        transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1
        ${collapsed ? "justify-center px-0 mx-auto w-11 h-11" : "px-3 ml-1"}
        ${
          isActive
            ? "bg-primary/10 text-primary font-semibold shadow-sm"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1"
        }
      `}
    >
      {/* Active indicator bar */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}

      <Icon
        className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
          isActive ? "scale-105 text-primary" : "group-hover:scale-105"
        }`}
      />

      {!collapsed && (
        <span className="text-sm truncate">{item.title}</span>
      )}

      {/* Badge de contagem (ex.: devidas no caderno) */}
      {!collapsed && !!item.badge && item.badge > 0 && (
        <span className="ml-auto shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-semibold tabular-nums px-1.5 py-0.5 min-w-[20px] text-center">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      {collapsed && !!item.badge && item.badge > 0 && (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <ShadcnSidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild className="p-0">
              {content}
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="font-medium">
            <p>{item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </ShadcnSidebarMenuItem>
    );
  }

  return (
    <ShadcnSidebarMenuItem>
      <SidebarMenuButton asChild className="p-0">
        {content}
      </SidebarMenuButton>
    </ShadcnSidebarMenuItem>
  );
}

interface SidebarNavGroupProps {
  title: string;
  icon: LucideIcon;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isActive: boolean;
  collapsed?: boolean;
  children: React.ReactNode;
}

export function SidebarNavGroup({
  title,
  icon: Icon,
  isOpen,
  onOpenChange,
  isActive,
  collapsed,
  children,
}: SidebarNavGroupProps) {
  const trigger = (
    <button
      type="button"
      aria-expanded={isOpen}
      className={`
        group relative flex items-center justify-between w-full gap-3 py-2.5
        rounded-xl
        transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1
        ${collapsed ? "justify-center px-0 mx-auto w-11 h-11" : "px-3 ml-1"}
        ${
          isActive
            ? "bg-primary/10 text-primary font-semibold shadow-sm"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
        }
      `}
    >
      {isActive && (
        <motion.div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full"
          layoutId="sidebar-active-group-indicator"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}

      <div className="flex items-center gap-3">
        <Icon
          className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
            isActive ? "scale-105 text-primary" : "group-hover:scale-105"
          }`}
        />
        {!collapsed && <span className="text-sm">{title}</span>}
      </div>

      {!collapsed && (
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <ShadcnSidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild className="p-0">
                <NavLink
                  to="/guia-estudos"
                  className={`
                    flex items-center justify-center w-11 h-11 mx-auto rounded-xl
                    transition-all duration-200
                    ${isActive ? "bg-primary/10 text-primary" : "hover:bg-sidebar-accent"}
                  `}
                >
                <Icon className="h-5 w-5" />
              </NavLink>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            <p className="font-medium">{title}</p>
          </TooltipContent>
        </Tooltip>
      </ShadcnSidebarMenuItem>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <ShadcnSidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton asChild className="p-0">
            {trigger}
          </SidebarMenuButton>
        </CollapsibleTrigger>
      </ShadcnSidebarMenuItem>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="ml-4 mt-1 pl-4 border-l-2 border-border/50 space-y-0.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SidebarSubItemProps {
  item: MenuItemData;
  isActive: boolean;
}

export function SidebarSubItem({ item, isActive }: SidebarSubItemProps) {
  const Icon = item.icon ?? (() => null);

  return (
    <NavLink
      to={item.url}
      end
      aria-current={isActive ? "page" : undefined}
      className={`
        group flex items-center gap-2.5 px-3 py-2 
        rounded-lg text-xs
        transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${
          isActive
            ? "bg-primary/8 text-primary font-semibold"
            : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        }
      `}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
      <span className="truncate">{item.title}</span>
    </NavLink>
  );
}
