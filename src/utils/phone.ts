/**
 * Utilitários para manipulação de telefone brasileiro, extraídos de
 * PhoneCollectionModal para reuso (ex.: EditProfileSheet).
 */

/** Remove tudo que não for dígito. */
export function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Aplica máscara brasileira progressiva: (XX) XXXX-XXXX (fixo) ou
 * (XX) XXXXX-XXXX (celular). Recebe qualquer entrada e devolve o
 * texto formatado com base apenas nos dígitos.
 */
export function maskPhone(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length < 3) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) {
    // fixo: 4 + 4
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  // celular: 5 + 4
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Verdadeiro se os dígitos formam um telefone BR válido (DDD + 8 ou 9 dígitos). */
export function isValidBrPhone(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

/**
 * Link wa.me a partir de um telefone em qualquer formato. Assume BR (+55) quando
 * vêm só DDD + número; se já vier com o 55 na frente (12–13 dígitos), respeita.
 * Devolve null quando não há dígitos suficientes para um número discável.
 */
export function whatsappLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = onlyDigits(raw);
  if (isValidBrPhone(digits)) return `https://wa.me/55${digits}`;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `https://wa.me/${digits}`;
  }
  return null;
}
