import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261014230000_mentoria_ajustes_revisao_final.sql'),
  'utf8',
);
const corpo = (nome: string) => {
  const m = SQL.match(new RegExp(`function public\\.${nome}\\([\\s\\S]*?\\$function\\$;`, 'i'));
  return m ? m[0] : '';
};

describe('migration mentoria_ajustes_revisao_final', () => {
  it('revoga as tabelas b2c_* de anon e authenticated', () => {
    expect(SQL).toMatch(/revoke all on table[\s\S]*?from anon, authenticated;/i);
    for (const t of ['b2c_simulados', 'b2c_questoes', 'b2c_alunos', 'b2c_tentativas', 'b2c_respostas', 'b2c_sync_execucoes']) {
      expect(SQL).toContain(`public.${t}`);
    }
  });

  describe('api_mentoria_sessoes', () => {
    const c = corpo('api_mentoria_sessoes');
    it('"próximas" considera início + duração, não só o início', () => {
      expect(c).toMatch(/s\.inicio \+ make_interval\(mins => s\.duracao_min\) >= now\(\)/);
      expect(c).not.toMatch(/s\.inicio >= now\(\)/);
    });
    it('mantém security definer, search_path e grants só de service_role', () => {
      expect(c).toMatch(/security definer/i);
      expect(c).toMatch(/set search_path to 'public', 'pg_temp'/i);
      expect(SQL).toMatch(/revoke all on function public\.api_mentoria_sessoes\(text, text\) from public/i);
      expect(SQL).toMatch(/revoke execute on function public\.api_mentoria_sessoes\(text, text\) from anon, authenticated/i);
      expect(SQL).not.toMatch(/grant\s+execute on function public\.api_mentoria_sessoes/i);
    });
  });

  describe('mentor_agenda_desligar', () => {
    const c = corpo('mentor_agenda_desligar');
    it('fecha o card aberto criado pela liberação', () => {
      expect(c).toMatch(/origem_ref->>'kind' = 'agenda_liberacao'/);
      expect(c).toMatch(/origem_ref->>'id' = d\.id::text/);
      expect(c).toMatch(/SET status = 'feito'/);
      expect(c).toMatch(/concluido_em = coalesce\(i\.concluido_em, now\(\)\)/);
      expect(c).toMatch(/i\.status <> 'feito'/);
      expect(c).toMatch(/i\.mentor_id = v_mentor/);
    });
    it('registra o evento e mantém o de agenda_desligada', () => {
      expect(c).toContain("'agenda_desligada'");
      expect(c).toContain("'intervencao_status'");
    });
    it('grants: authenticated, sem anon/public', () => {
      expect(SQL).toMatch(/revoke all on function public\.mentor_agenda_desligar\(text\[\]\) from public/i);
      expect(SQL).toMatch(/revoke execute on function public\.mentor_agenda_desligar\(text\[\]\) from anon/i);
      expect(SQL).toMatch(/grant execute on function public\.mentor_agenda_desligar\(text\[\]\) to authenticated/i);
    });
  });

  describe('admin_upsert_mentor', () => {
    const c = corpo('admin_upsert_mentor');
    it('exige https:// em link_agendamento e foto_url', () => {
      expect(c).toContain("'^https://[^\\s]+$'");
      expect(c).toMatch(/btrim\(p_link_agendamento\) !~\*/);
      expect(c).toMatch(/btrim\(p_foto_url\) !~\*/);
      expect(c).toContain("RAISE EXCEPTION 'link precisa começar com https://'");
    });
    it('branco/nulo continua permitido', () => {
      expect(c).toMatch(/coalesce\(btrim\(p_link_agendamento\), ''\) <> ''/);
      expect(c).toMatch(/coalesce\(btrim\(p_foto_url\), ''\) <> ''/);
    });
    it('preserva a checagem de admin e os grants', () => {
      expect(c).toMatch(/has_role\(auth\.uid\(\), 'admin'::app_role\)/);
      expect(SQL).toMatch(/grant execute on function public\.admin_upsert_mentor\(uuid, text, text, uuid, text, text, text, boolean\) to authenticated/i);
      expect(SQL).toMatch(/revoke execute on function public\.admin_upsert_mentor\([^)]*\) from anon/i);
    });
  });

  it('bucket mural-anexos: 10 MB e tipos permitidos', () => {
    expect(SQL).toMatch(/update storage\.buckets/i);
    expect(SQL).toContain('file_size_limit = 10485760');
    expect(SQL).toContain("array['image/png','image/jpeg','image/webp','application/pdf']");
    expect(SQL).toContain("where id = 'mural-anexos'");
  });
});
