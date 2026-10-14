const TZ = 'America/Sao_Paulo';

function partes(iso: string): Record<string, string> | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const out: Record<string, string> = {};
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(d)
    .forEach((p) => {
      out[p.type] = p.value;
    });
  return out;
}

/** "dd/MM/yyyy HH:mm" no fuso de São Paulo. */
export function formatarDataHora(iso: string): string {
  const p = partes(iso);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : '—';
}

/** "dd/MM/yyyy" no fuso de São Paulo. */
export function formatarData(iso: string): string {
  const p = partes(iso);
  return p ? `${p.day}/${p.month}/${p.year}` : '—';
}

/** ISO -> valor de `<input type="datetime-local">` (horário de São Paulo). */
export function isoParaCampo(iso: string): string {
  const p = partes(iso);
  return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` : '';
}

/** Valor de `<input type="datetime-local">` (horário de São Paulo, UTC-3 fixo) -> ISO. */
export function campoParaIso(valor: string): string {
  return new Date(`${valor}:00-03:00`).toISOString();
}

/** Só aceita https com host. */
export function ehLinkHttps(valor: string): boolean {
  try {
    const u = new URL(valor.trim());
    return u.protocol === 'https:' && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Link seguro para href: só http(s). Bloqueia javascript:, data: etc. */
export function ehLinkSeguro(valor: string | null | undefined): boolean {
  if (!valor || !/^https?:\/\//i.test(valor.trim())) return false;
  try {
    const u = new URL(valor.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.length > 0;
  } catch {
    return false;
  }
}
