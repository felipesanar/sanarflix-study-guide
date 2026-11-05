import { SheetTrigger } from '@/components/ui/sheet';
import { Icon } from '@/features/gestor/components/Icon';

export function HeaderMobile({ contexto }: { contexto: string }) {
  return (
    <header className="mentor-header-mobile">
      <SheetTrigger asChild>
        <button type="button" className="mentor-menu-trigger" aria-label="Abrir menu">
          <span className="mentor-menu-icon"><Icon name="menu" size={18} /></span>
        </button>
      </SheetTrigger>
      <img src="/sanarflix-academy-lockup.svg" alt="SanarFlix Academy" className="mentor-lockup-mobile" />
      <span className="mentor-header-contexto" title={contexto}>{contexto}</span>
    </header>
  );
}
