import * as XLSX from 'xlsx';
import type { LinhaVinculo } from '@/services/admin/mentores';

/** minúsculas, sem acento, sem espaço/hífen/underscore. */
const chave = (valor: string) =>
  valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '');

/**
 * Lê a planilha de alunos do mentor (.xlsx ou .csv). Colunas: `email`
 * (obrigatória) e `nome` (opcional). A validação de e-mail, duplicidade e
 * vínculo com outro mentor é do banco (`admin_importar_vinculos` em dry run).
 */
export async function parseVinculosFile(file: File): Promise<LinhaVinculo[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: false, defval: '' });
  if (rows.length === 0) return [];

  const header = rows[0].map((c) => chave(String(c ?? '')));
  const iEmail = header.indexOf('email');
  const iNome = header.indexOf('nome');
  if (iEmail < 0) throw new Error('A planilha precisa de uma coluna "email".');

  const linhas: LinhaVinculo[] = [];
  for (const row of rows.slice(1)) {
    const email = String(row[iEmail] ?? '').trim().toLowerCase();
    const nome = iNome >= 0 ? String(row[iNome] ?? '').trim() : '';
    if (!email && !nome) continue;
    linhas.push(nome ? { email, nome } : { email });
  }
  return linhas;
}
