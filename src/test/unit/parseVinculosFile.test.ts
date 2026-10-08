import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVinculosFile } from '@/components/admin/mentores/parseVinculosFile';

function planilha(rows: (string | number)[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'alunos.xlsx');
}

describe('parseVinculosFile', () => {
  it('lê email e nome, normalizando o e-mail', async () => {
    const linhas = await parseVinculosFile(planilha([['email', 'nome'], [' Ana@X.com ', 'Ana Lima']]));
    expect(linhas).toEqual([{ email: 'ana@x.com', nome: 'Ana Lima' }]);
  });

  it('aceita cabeçalho "E-mail" com maiúscula e hífen', async () => {
    const linhas = await parseVinculosFile(planilha([['E-mail'], ['bia@x.com']]));
    expect(linhas).toEqual([{ email: 'bia@x.com' }]);
  });

  it('ignora linhas totalmente vazias', async () => {
    const linhas = await parseVinculosFile(planilha([['email'], [''], ['caio@x.com']]));
    expect(linhas).toEqual([{ email: 'caio@x.com' }]);
  });

  it('sem coluna de e-mail: erro claro', async () => {
    await expect(parseVinculosFile(planilha([['nome'], ['Duda']]))).rejects.toThrow('coluna "email"');
  });
});
