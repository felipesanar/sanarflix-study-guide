// src/test/unit/mentoriaOnda2Tabelas.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase', 'migrations');
const ler = (nome: string) => readFileSync(join(dir, nome), 'utf8');
const TAB = ler('20261014200000_mentoria_onda2_tabelas.sql');

const TABELAS = [
  'mentoria_sessoes', 'mentoria_agenda_liberacoes', 'mural_posts', 'mural_destinatarios',
  'mentoria_intervencoes', 'mentoria_intervencao_alunos', 'mentoria_intervencao_comentarios', 'mentoria_eventos',
];

describe('Onda 2 · tabelas', () => {
  it.each(TABELAS)('%s tem RLS ligada', (t) => {
    expect(TAB).toMatch(new RegExp(`alter table public\.${t} enable row level security`, 'i'));
  });

  it('nenhuma policy de escrita nas tabelas novas', () => {
    const policies = (TAB.match(/create policy[\s\S]*?;/gi) ?? []).filter((p) => !/storage\.objects/i.test(p));
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) expect(p).toMatch(/for select/i);
  });

  it('arquivo 2025: sessão sem mentor só com origem arquivo_2025', () => {
    expect(TAB).toMatch(/check \(mentor_id is not null or origem = 'arquivo_2025'\)/i);
  });

  it('sessão individual exige aluno', () => {
    expect(TAB).toMatch(/check \(tipo <> 'individual' or aluno_email is not null\)/i);
  });

  it('link do mural exige título', () => {
    expect(TAB).toMatch(/check \(link_url is null or link_titulo is not null\)/i);
  });

  it('uma liberação de agenda ligada por mentor e aluno', () => {
    expect(TAB).toMatch(/create unique index \w+\s+on public\.mentoria_agenda_liberacoes \(mentor_id, aluno_email\)\s+where ligado/i);
  });

  it('mentor_ativo_id exige papel e cadastro ativo', () => {
    expect(TAB).toMatch(/function public\.mentor_ativo_id\(\)[\s\S]*has_role\(auth\.uid\(\), 'mentor'::app_role\)[\s\S]*m\.ativo/i);
  });

  it('bucket mural-anexos é privado e o mentor só toca a própria pasta', () => {
    expect(TAB).toMatch(/insert into storage\.buckets[\s\S]*'mural-anexos'[\s\S]*false/i);
    expect(TAB).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
  });
});
