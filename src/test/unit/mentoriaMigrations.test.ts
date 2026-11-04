/**
 * Testes de texto das migrations da Página do Mentor (Onda 1).
 * Não há pgTAP neste repo: o teste lê o SQL e trava as regras que, se
 * sumirem numa recriação futura, abrem dado de aluno ou quebram o acesso.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase', 'migrations');
const ler = (nome: string) => readFileSync(join(dir, nome), 'utf8');

const ENUM = ler('20261009125338_app_role_mentor.sql');
const FUNDACAO = ler('20261009125425_mentoria_fundacao.sql');
const RPCS = ler('20261009125504_mentoria_rpcs_admin.sql');

/** Corpo de uma função (do CREATE até o $$ que fecha). */
const corpo = (sql: string, nome: string): string => {
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${nome}\\s*\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`,
    'i',
  );
  const m = sql.match(re);
  if (!m) throw new Error(`função ${nome} não encontrada`);
  return m[1];
};

describe('migration do enum', () => {
  it('só adiciona o valor mentor, sozinho no arquivo', () => {
    const semComentario = ENUM.replace(/--.*$/gm, '').trim();
    expect(semComentario).toBe("ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';");
  });
});

describe('tabelas e RLS', () => {
  it('um vínculo ativo por aluno (índice único parcial por e-mail)', () => {
    expect(FUNDACAO).toMatch(
      /create unique index mentoria_vinculos_um_ativo_por_aluno\s+on public\.mentoria_vinculos \(email_normalizado\)\s+where fim is null/i,
    );
  });

  it('mentor b2b exige IES', () => {
    expect(FUNDACAO).toMatch(/check \(tipo = 'b2c' or ies_id is not null\)/i);
  });

  it('RLS ligada nas duas tabelas', () => {
    expect(FUNDACAO).toMatch(/alter table public\.mentores enable row level security/i);
    expect(FUNDACAO).toMatch(/alter table public\.mentoria_vinculos enable row level security/i);
  });

  it('nenhuma policy de escrita: só leitura (escrita é por RPC)', () => {
    const policies = FUNDACAO.match(/create policy[\s\S]*?;/gi) ?? [];
    expect(policies.length).toBe(4);
    for (const p of policies) expect(p).toMatch(/for select/i);
  });

  it('mentor só lê os próprios vínculos, com papel mentor e cadastro ativo', () => {
    const m = FUNDACAO.match(/create policy "Mentor lê os próprios vínculos"[\s\S]*?;/i);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/mentor_id = auth\.uid\(\)/i);
    expect(m![0]).toMatch(/has_role\(auth\.uid\(\), 'mentor'::app_role\)/i);
    expect(m![0]).toMatch(/exists \(select 1 from public\.mentores m where m\.user_id = auth\.uid\(\) and m\.ativo\)/i);
  });

  it('mentor só lê o próprio cadastro se ainda tiver o papel mentor', () => {
    const m = FUNDACAO.match(/create policy "Mentor lê o próprio cadastro"[\s\S]*?;/i);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/user_id = auth\.uid\(\)/i);
    expect(m![0]).toMatch(/has_role\(auth\.uid\(\), 'mentor'::app_role\)/i);
  });

  it('histórico sobrevive à exclusão de conta: sem cascade em vínculos, created_by set null', () => {
    expect(FUNDACAO).toMatch(/mentor_id uuid not null references public\.mentores\(user_id\) on delete restrict/i);
    expect((FUNDACAO.match(/created_by uuid references auth\.users\(id\) on delete set null/gi) ?? []).length).toBe(2);
  });
});

describe('get_access', () => {
  const body = corpo(FUNDACAO, 'get_access');

  it('papel mentor concede a experiência mentor e mentoria.view', () => {
    expect(body).toMatch(/'mentor' = any\(v_roles\)/i);
    expect(body).toMatch(/array\['mentor'\]/i);
    expect(body).toMatch(/'mentoria\.view'/i);
  });

  it('admin ganha mentores.manage e mantém as capabilities de antes', () => {
    for (const cap of ['users.manage', 'users.edit', 'impersonate', 'institutional.view', 'mentores.manage']) {
      expect(body).toContain(`'${cap}'`);
    }
  });

  it('atendimento e gestor continuam iguais', () => {
    expect(body).toMatch(/array\['users\.support','users\.edit','feedbacks\.support'\]/i);
    expect(body).toMatch(/array\['institutional\.view','alunos\.view'\]/i);
  });
});

describe('RPCs de admin', () => {
  for (const nome of ['admin_upsert_mentor', 'admin_list_mentores', 'admin_importar_vinculos', 'admin_encerrar_vinculo']) {
    it(`${nome} exige admin e é SECURITY DEFINER`, () => {
      const re = new RegExp(`function public\\.${nome}[\\s\\S]*?security definer[\\s\\S]*?\\$function\\$`, 'i');
      expect(RPCS).toMatch(re);
      expect(corpo(RPCS, nome)).toMatch(/if not public\.has_role\(auth\.uid\(\), 'admin'::app_role\) then/i);
    });
  }

  it('upsert, importação e encerramento gravam auditoria', () => {
    for (const nome of ['admin_upsert_mentor', 'admin_importar_vinculos', 'admin_encerrar_vinculo']) {
      expect(corpo(RPCS, nome)).toMatch(/insert into public\.admin_audit_log/i);
    }
  });

  it('importação: trocar encerra o vínculo antigo, nunca apaga', () => {
    const body = corpo(RPCS, 'admin_importar_vinculos');
    expect(body).toMatch(/update public\.mentoria_vinculos[\s\S]*?set fim = now\(\)/i);
    expect(body).not.toMatch(/delete from public\.mentoria_vinculos/i);
  });

  it('importação: dry run não escreve', () => {
    const body = corpo(RPCS, 'admin_importar_vinculos');
    expect(body).toMatch(/if not p_dry_run then/i);
  });

  it('upsert recusa as IES internas Sanar como IES de mentor B2B', () => {
    const body = corpo(RPCS, 'admin_upsert_mentor');
    expect(body).toContain('9f21b138-0027-44c8-9660-dc6706d57bc0');
    expect(body).toContain('abec7c7d-ef07-4871-9e19-090f4d951e5e');
    expect(body).toMatch(/IES interna não pode ser a IES de um mentor B2B/);
  });

  it('importação escolhe o sanarflix_user_id preferindo aluno ativo, nulos por último', () => {
    expect(corpo(RPCS, 'admin_importar_vinculos')).toMatch(/order by \(d\.status_atual = 'ativo'\) desc nulls last/i);
  });

  it('get_mentor_contexto devolve só o mentor logado', () => {
    expect(corpo(RPCS, 'get_mentor_contexto')).toMatch(/where m\.user_id = auth\.uid\(\)/i);
  });
});

describe('revogação do anon (aplicada em prod em 09/10/2026)', () => {
  const REVOGA = ler('20261009125601_mentoria_revoga_anon.sql');

  it('nenhuma das seis funções novas fica executável sem login', () => {
    for (const assinatura of [
      'mentor_pode_ver_aluno(text)',
      'admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean)',
      'admin_list_mentores()',
      'admin_importar_vinculos(uuid, jsonb, boolean, boolean)',
      'admin_encerrar_vinculo(uuid)',
      'get_mentor_contexto()',
    ]) {
      expect(REVOGA).toContain(`revoke execute on function public.${assinatura} from anon;`);
    }
  });
});
