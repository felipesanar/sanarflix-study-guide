/**
 * Testes estáticos da migration das tabelas espelho dos simulados B2C
 * (Onda 3 da Página do Mentor). Não há harness de pgTAP neste repo, então
 * validamos o texto do SQL.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20261014170837_b2c_simulados_espelho.sql"),
  "utf8",
);

const TABELAS = [
  "b2c_simulados",
  "b2c_questoes",
  "b2c_alunos",
  "b2c_tentativas",
  "b2c_respostas",
  "b2c_sync_execucoes",
];

describe("migration b2c_simulados_espelho", () => {
  it.each(TABELAS)("cria %s", (t) => {
    expect(sql).toMatch(new RegExp(String.raw`create table public\.${t}\s*\(`, "i"));
  });

  it.each(TABELAS)("liga RLS em %s", (t) => {
    expect(sql).toMatch(
      new RegExp(String.raw`alter table public\.${t}\s+enable row level security`, "i"),
    );
  });

  it("liga RLS nas 6 tabelas (contagem)", () => {
    expect(sql.match(/enable row level security/gi)?.length).toBe(6);
  });

  it("não cria nenhuma policy (leitura só por RPC SECURITY DEFINER)", () => {
    expect(sql).not.toMatch(/create\s+policy/i);
  });

  it("garante e-mail minúsculo em b2c_alunos", () => {
    expect(sql).toMatch(/email text primary key check \(email = lower\(email\)\)/i);
  });

  it("tentativas e respostas caem em cascata", () => {
    expect(sql).toMatch(
      /email text not null references public\.b2c_alunos\(email\) on delete cascade/i,
    );
    expect(sql).toMatch(
      /simulado_id uuid not null references public\.b2c_simulados\(id\) on delete cascade/i,
    );
    expect(sql).toMatch(
      /tentativa_id uuid not null references public\.b2c_tentativas\(id\) on delete cascade/i,
    );
    expect(sql).toMatch(
      /questao_id uuid not null references public\.b2c_questoes\(id\) on delete cascade/i,
    );
  });

  it("indexa b2c_tentativas por (email, finalizada_em desc)", () => {
    expect(sql).toMatch(
      /create index b2c_tentativas_email on public\.b2c_tentativas \(email, finalizada_em desc\)/i,
    );
  });

  it("documenta a origem e o acesso no cabeçalho", () => {
    expect(sql.split("\n")[0]).toMatch(/^--/);
    expect(sql).toMatch(/service role/i);
    expect(sql).toMatch(/SECURITY DEFINER/);
  });
});
