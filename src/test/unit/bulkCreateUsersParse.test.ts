/**
 * Parser da planilha de cadastro em lote: colunas `matricula_ra` e `papel`.
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseUsersFile } from '@/components/admin/usuarios/BulkCreateUsersDialog';
import { normalizeRoleInput } from '@/components/admin/usuarios/roles';

function planilha(rows: (string | number)[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'lote.xlsx');
}

const HEADER = ['nome', 'email', 'semestre', 'matricula_ra', 'papel'];

describe('normalizeRoleInput', () => {
  it('vazio vira aluno', () => {
    expect(normalizeRoleInput('')).toBe('aluno');
    expect(normalizeRoleInput(null)).toBe('aluno');
  });

  it('aceita rótulo com espaço/maiúscula/acento', () => {
    expect(normalizeRoleInput('Gestor de Grupo')).toBe('gestor_grupo');
    expect(normalizeRoleInput(' ATENDIMENTO ')).toBe('atendimento');
  });

  it('recusa papel inexistente', () => {
    expect(normalizeRoleInput('coordenador')).toBeNull();
  });
});

describe('parseUsersFile', () => {
  it('papel em branco => aluno e RA vazio => null', async () => {
    const rows = await parseUsersFile(planilha([HEADER, ['Ana', 'ana@x.com', 3, '', '']]), true);
    expect(rows[0].role).toBe('aluno');
    expect(rows[0].matricula_ra).toBeNull();
    expect(rows[0].erro).toBeUndefined();
  });

  it('lê RA e papel válidos', async () => {
    const rows = await parseUsersFile(planilha([HEADER, ['Bia', 'bia@x.com', '', '2023001', 'Professor']]), true);
    expect(rows[0].matricula_ra).toBe('2023001');
    expect(rows[0].role).toBe('professor');
    expect(rows[0].erro).toBeUndefined();
  });

  it('papel inválido gera erro de linha', async () => {
    const rows = await parseUsersFile(planilha([HEADER, ['Caio', 'caio@x.com', '', '', 'diretor']]), true);
    expect(rows[0].erro).toContain('Papel inválido');
  });

  it('RA maior que 50 caracteres gera erro', async () => {
    const rows = await parseUsersFile(planilha([HEADER, ['Duda', 'duda@x.com', '', 'x'.repeat(51), '']]), true);
    expect(rows[0].erro).toContain('Matrícula/RA');
  });

  it('sem users.manage só aceita aluno', async () => {
    const rows = await parseUsersFile(planilha([HEADER, ['Edu', 'edu@x.com', '', '', 'admin']]), false);
    expect(rows[0].erro).toContain('não permitido');
  });
});
