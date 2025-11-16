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
 */
export const datetimeLocalToBrazilISO = (datetimeLocalValue: string): string => {
  if (!datetimeLocalValue) return '';
  
  // Parse the datetime-local value
  const [date, time] = datetimeLocalValue.split('T');
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  
  // Create date string in format that toLocaleString accepts
  const dateStr = `${month}/${day}/${year} ${hour}:${minute}:00`;
  
  // Convert to Brazil timezone and then to ISO
  const brazilDate = new Date(new Date(dateStr).toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo' 
  }));
  
  return brazilDate.toISOString();
};

/**
 * Converts a Brazil timezone ISO string to datetime-local input format
 * @param isoString - ISO string
 * @returns datetime-local format (YYYY-MM-DDTHH:mm)
 */
export const brazilISOToDatetimeLocal = (isoString: string): string => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const brazilDate = new Date(date.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo' 
  }));
  
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  const hour = String(brazilDate.getHours()).padStart(2, '0');
  const minute = String(brazilDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
};
