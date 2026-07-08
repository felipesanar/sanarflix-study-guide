/**
 * Timezone utilities for Brazil (GMT-3 / America/Sao_Paulo)
 * Ensures all time-based features use consistent timezone
 */

/**
 * Gets the current day of week in Brazil timezone (0 = Sunday, 6 = Saturday)
 * @returns Day of week number (0-6)
 */
export const getBrazilDayOfWeek = (): number => {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo' 
  }));
  return brazilTime.getDay();
};

/**
 * Gets the current date/time in Brazil timezone
 * @returns Date object representing current time in Brazil
 */
export const getBrazilDate = (): Date => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo' 
  }));
};

/**
 * Gets the current hour in Brazil timezone (0-23)
 * @returns Hour number
 */
export const getBrazilHour = (): number => {
  return getBrazilDate().getHours();
};

/**
 * Converts a Date or ISO string to a Date object in Brazil timezone
 */
export const toBrazilDate = (input: string | Date): Date => {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
};

/**
 * Converts a local datetime-local input value to Brazil timezone ISO string
 * @param datetimeLocalValue - Value from datetime-local input (YYYY-MM-DDTHH:mm)
 * @returns ISO string in Brazil timezone
 *
 * NOTA: o Brasil não observa mais horário de verão desde 2019 — o offset de
 * Brasília é sempre fixo em -03:00. Anexar esse offset explicitamente ao
 * valor do input (que já vem como "YYYY-MM-DDTHH:mm") faz o `Date` nativo
 * interpretar o horário corretamente como Brasília, INDEPENDENTE do fuso
 * horário do browser. A implementação anterior fazia uma dupla conversão via
 * `toLocaleString` que só dava o resultado certo se o browser já estivesse
 * em America/Sao_Paulo — em qualquer outro fuso o erro dobrava o offset
 * (ex.: em UTC, o valor salvo saía 6h errado em vez de 3h).
 */
export const datetimeLocalToBrazilISO = (datetimeLocalValue: string): string => {
  if (!datetimeLocalValue) return '';

  return new Date(`${datetimeLocalValue}:00-03:00`).toISOString();
};

/**
 * Converts a Brazil timezone ISO string to datetime-local input format
 * @param isoString - ISO string
 * @returns datetime-local format (YYYY-MM-DDTHH:mm)
 *
 * Mesmo racional do offset fixo -03:00 de `datetimeLocalToBrazilISO`: desloca
 * o instante UTC em 3h e lê os componentes em UTC, o que evita qualquer
 * dependência do fuso horário do browser (correto em qualquer fuso, não só
 * quando o browser está em America/Sao_Paulo).
 */
export const brazilISOToDatetimeLocal = (isoString: string): string => {
  if (!isoString) return '';

  const date = new Date(isoString);
  const brazilShifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);

  const year = brazilShifted.getUTCFullYear();
  const month = String(brazilShifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brazilShifted.getUTCDate()).padStart(2, '0');
  const hour = String(brazilShifted.getUTCHours()).padStart(2, '0');
  const minute = String(brazilShifted.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
};
