import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toBrazilDate } from '@/utils/timezone';

export function formatTempo(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (horas === 0) return `${minutos}m`;
  return `${horas}h ${minutos}m`;
}

export function formatFinalizado(iso: string): string {
  return format(toBrazilDate(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDataCurta(iso: string): string {
  return format(toBrazilDate(iso), 'dd/MM/yyyy', { locale: ptBR });
}
