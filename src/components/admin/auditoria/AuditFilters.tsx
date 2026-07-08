import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AUDIT_ACTION_OPTIONS } from '@/services/admin/auditActions';

export type AuditPeriod = '24h' | '7d' | '30d' | 'all';

export interface AuditFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  action: string;
  onActionChange: (value: string) => void;
  period: AuditPeriod;
  onPeriodChange: (value: AuditPeriod) => void;
  /** "Ocultar navegação (view_*)" — ligado por default (ver AuditoriaSection). */
  hideNavigation: boolean;
  onHideNavigationChange: (value: boolean) => void;
}

/** Filtros de `/admin/auditoria`: busca (debounced pelo pai), ação, período e toggle de ruído. */
export function AuditFilters({
  search,
  onSearchChange,
  action,
  onActionChange,
  period,
  onPeriodChange,
  hideNavigation,
  onHideNavigationChange,
}: AuditFiltersProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por ator, alvo ou ação…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={action} onValueChange={onActionChange}>
        <SelectTrigger className="w-full md:w-56">
          <SelectValue placeholder="Ação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as ações</SelectItem>
          {AUDIT_ACTION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={period} onValueChange={(v) => onPeriodChange(v as AuditPeriod)}>
        <SelectTrigger className="w-full md:w-40">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="24h">Últimas 24h</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="all">Tudo</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex shrink-0 items-center gap-2 md:pl-1">
        <Switch id="audit-hide-navigation" checked={hideNavigation} onCheckedChange={onHideNavigationChange} />
        <Label htmlFor="audit-hide-navigation" className="cursor-pointer whitespace-nowrap text-sm font-normal text-muted-foreground">
          Ocultar navegação (view_*)
        </Label>
      </div>
    </div>
  );
}

export default AuditFilters;
