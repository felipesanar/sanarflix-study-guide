import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261014170827_mentoria_onda2_rpcs_api.sql'),
  'utf8',
);
const FUNCOES = ['api_mentoria_me', 'api_mentoria_mural', 'api_mentoria_sessoes'];
const corpo = (nome: string) => {
  const m = SQL.match(new RegExp(`function public\\.${nome}\\([\\s\\S]*?\\$function\\$;`, 'i'));
  return m ? m[0] : '';
};

describe('Onda 2 · RPCs da API de Mentoria', () => {
  it('assinaturas', () => {
    expect(SQL).toMatch(/function public\.api_mentoria_me\(p_email text\)/i);
    expect(SQL).toMatch(/function public\.api_mentoria_mural\(p_email text, p_aba text, p_cursor timestamptz\)/i);
    expect(SQL).toMatch(/function public\.api_mentoria_sessoes\(p_email text, p_quando text\)/i);
  });

  it.each(FUNCOES)('%s é security definer com search_path fixo', (f) => {
    const c = corpo(f);
    expect(c).not.toBe('');
    expect(c).toMatch(/security definer/i);
    expect(c).toMatch(/set search_path to 'public', 'pg_temp'/i);
  });

  it.each(FUNCOES)('%s: revoke de public, anon e authenticated', (f) => {
    expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public`, 'i'));
    expect(SQL).toMatch(new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from anon, authenticated`, 'i'));
  });

  it('nenhum grant para authenticated, anon ou public', () => {
    expect(SQL).not.toMatch(/grant\s+execute[^;]*to\s+(authenticated|anon|public)/i);
  });

  it('mentor atual = vínculo sem fim, e-mail normalizado, mentor ativo', () => {
    expect(SQL).toMatch(/lower\(btrim\(p_email\)\)/i);
    expect(SQL).toMatch(/fim is null/i);
    expect(SQL).toMatch(/m\.ativo/i);
  });

  it('mural: só publicados', () => {
    expect(corpo('api_mentoria_mural')).toMatch(/status = 'publicado'/i);
  });

  it('mural: coletivo = publico turma; pra-voce filtra por mural_destinatarios', () => {
    const c = corpo('api_mentoria_mural');
    expect(c).toMatch(/publico = 'turma'/i);
    expect(c).toMatch(/publico = 'selecionados'/i);
    expect(c).toMatch(/from public\.mural_destinatarios/i);
  });

  it('mural: página de 20, cursor e ordem por publicado_em desc', () => {
    const c = corpo('api_mentoria_mural');
    expect(c).toMatch(/publicado_em < p_cursor/i);
    expect(c).toMatch(/order by p\.publicado_em desc/i);
    expect(c).toMatch(/limit 21/i);
    expect(c).toMatch(/tem_pra_voce/);
    expect(c).toMatch(/proximo_cursor/);
    expect(c).toMatch(/anexo_path/);
  });

  it('mural: aba inválida levanta erro', () => {
    expect(corpo('api_mentoria_mural')).toMatch(/raise exception/i);
  });

  it('me: link de agendamento só com liberação ligada', () => {
    const c = corpo('api_mentoria_me');
    expect(c).toMatch(/mentoria_agenda_liberacoes/);
    expect(c).toMatch(/ligado/);
    expect(c).toMatch(/agendamento_liberado/);
    expect(c).toMatch(/tem_mentor/);
  });

  it('sessoes: próximas só agendadas futuras, coletivas + individual do próprio aluno', () => {
    const c = corpo('api_mentoria_sessoes');
    expect(c).toMatch(/status = 'agendada'/i);
    expect(c).toMatch(/inicio >= now\(\)/i);
    expect(c).toMatch(/aluno_email = v_email/i);
  });

  it('sessoes: realizadas são coletivas, de todos os mentores, com arquivo 2025', () => {
    const c = corpo('api_mentoria_sessoes');
    expect(c).toMatch(/status = 'realizada'/i);
    expect(c).toMatch(/arquivo_2025/);
  });
});
