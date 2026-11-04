import type { ReactNode } from 'react';
import { SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

export function SidebarDrawer({ children }: { children: ReactNode }) {
  const container = useGestorPortalContainer();
  return (
    <SheetContent
      container={container}
      side="left"
      className="mentor-sidebar-drawer"
      overlayClassName="mentor-sidebar-scrim"
      closeClassName="mentor-drawer-close"
      closeLabel="Fechar menu"
      closeIcon={<Icon name="close" size={18} />}
      aria-describedby={undefined}
    >
      <SheetTitle className="sr-only">Menu do mentor</SheetTitle>
      {children}
    </SheetContent>
  );
}
