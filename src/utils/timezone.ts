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
