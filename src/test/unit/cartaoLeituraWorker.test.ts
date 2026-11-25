import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  autorizado,
  caminhosDeRecorte,
  compararSegredo,
  ehAcao,
  linhasDoResultado,
  runUrlValida,
} from '../../../supabase/functions/cartao-leitura-worker/logica';

const L = '11111111-2222-4333-8444-555555555555';
const SEGREDO = 'segredo-bem-comprido-123';

const pagina = (extra: Record<string, unknown> = {}) => ({
  pagina: 1,
  destino: 'respostas',
  status: 'ok',
  layout: 'sfa',
  identificacao: '2023001',
  via: 'matricula',
  motivo: '',
  respostas: { '1': 'A', '2': null },
  duvidas: {},
  pendencias: [],
  ...extra,
});
const resultado = (paginas: unknown[]) => ({ versao: 1, resumo: { paginas: paginas.length }, paginas });

describe('cartao-leitura-worker/logica', () => {
  it('autorização: só o Bearer exato; segredo ausente ou curto nega', () => {
    expect(autorizado(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true);
    expect(autorizado(`Bearer ${SEGREDO}x`, SEGREDO)).toBe(false);
    expect(autorizado(SEGREDO, SEGREDO)).toBe(false);
    expect(autorizado(null, SEGREDO)).toBe(false);
    expect(autorizado('Bearer ', undefined)).toBe(false);
    expect(autorizado('Bearer curto', 'curto')).toBe(false);
    expect(compararSegredo('abc', 'abd')).toBe(false);
  });

  it('ações conhecidas', () => {
    expect(['obter', 'urls_recortes', 'concluir', 'falhar'].every(ehAcao)).toBe(true);
    expect(ehAcao('apagar')).toBe(false);
  });

  it('recortes ficam presos em <leitura>/recortes/ e sem repetição', () => {
    expect(caminhosDeRecorte(L, ['recortes/pagina_0001_x.png', 'recortes/pagina_0001_x.png'])).toEqual([
      `${L}/recortes/pagina_0001_x.png`,
    ]);
    for (const ruim of ['../scan.pdf', 'recortes/../../x.png', 'recortes/a.pdf', 'outra/a.png', 'recortes/sub/a.png']) {
      expect(caminhosDeRecorte(L, [ruim])).toHaveProperty('erro');
    }
    expect(caminhosDeRecorte(L, [])).toHaveProperty('erro');
    expect(caminhosDeRecorte(L, 'recortes/a.png')).toHaveProperty('erro');
  });

  it('resultado válido vira linhas com caminhos do bucket', () => {
    const r = linhasDoResultado(L, 2, resultado([
      pagina(),
      pagina({
        pagina: 2, destino: 'nao_identificados', identificacao: null, via: null, motivo: 'cartao_generico',
        imagem: 'recortes/pagina_0002_pagina.png',
        pendencias: [{ tipo: 'cartao_generico', detalhe: 'x', questao: null, recorte: 'recortes/pagina_0002_cartao_generico.png' }],
        duvidas: { '2': 'multipla', '3': 'outra' },
      }),
    ]));
    if ('erro' in r) throw new Error(r.erro);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0]).toMatchObject({ leitura_id: L, pagina: 1, respostas: { '1': 'A', '2': null }, imagem: null });
    expect(r.linhas[1].imagem).toBe(`${L}/recortes/pagina_0002_pagina.png`);
    expect(r.linhas[1].pendencias[0].recorte).toBe(`${L}/recortes/pagina_0002_cartao_generico.png`);
    expect(r.linhas[1].duvidas).toEqual({ '2': 'multipla' });
    expect(r.resumo).toEqual({ paginas: 2 });
  });

  it('recorte fora do padrão vira nulo (não aponta para fora da leitura)', () => {
    const r = linhasDoResultado(L, 2, resultado([pagina({ imagem: '../outra/scan.pdf' })]));
    if ('erro' in r) throw new Error(r.erro);
    expect(r.linhas[0].imagem).toBeNull();
  });

  it.each([
    [{ versao: 2, resumo: {}, paginas: [] }, /versão/],
    [{ versao: 1, resumo: {}, paginas: {} }, /lista/],
    [{ versao: 1, paginas: [] }, /resumo/],
    [resultado([pagina(), pagina()]), /repetida/],
    [resultado([pagina({ pagina: 0 })]), /página inválida/],
    [resultado([pagina({ destino: 'lixo' })]), /destino/],
    [resultado([pagina({ respostas: { '3': 'A' } })]), /fora do simulado/],
    [resultado([pagina({ respostas: { '1': 'F' } })]), /resposta inválida/],
    [null, /ausente/],
  ])('resultado inválido é recusado (%#)', (entrada, erro) => {
    const r = linhasDoResultado(L, 2, entrada);
    expect('erro' in r && r.erro).toMatch(erro);
  });

  it('link do run: só GitHub Actions', () => {
    expect(runUrlValida('https://github.com/o/r/actions/runs/123')).toBe('https://github.com/o/r/actions/runs/123');
    expect(runUrlValida('https://evil.com/actions/runs/1')).toBeNull();
    expect(runUrlValida(undefined)).toBeNull();
  });

  it('config.toml: worker sem verify_jwt, iniciar com verify_jwt', () => {
    const toml = readFileSync(join(process.cwd(), 'supabase/config.toml'), 'utf-8');
    expect(toml).toMatch(/\[functions\.cartao-leitura-worker\][^[]*verify_jwt = false/);
    expect(toml).toMatch(/\[functions\.cartao-leitura-iniciar\][^[]*verify_jwt = true/);
  });
});

describe('migration cartao_leituras', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261125120000_cartao_leituras.sql'), 'utf-8');

  it('revoga de authenticated (default ACL) antes dos GRANTs explícitos', () => {
    for (const t of ['cartao_leituras', 'cartao_leitura_paginas']) {
      expect(sql).toContain(`REVOKE ALL ON public.${t} FROM public, anon, authenticated;`);
      expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    }
    expect(sql).not.toMatch(/GRANT[^;]*TO anon/);
    expect(sql).not.toMatch(/GRANT (ALL|INSERT|DELETE)[^;]*cartao_leitura_paginas[^;]*TO authenticated/);
  });

  it('toda policy exige admin', () => {
    const policies = sql.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(8);
    for (const p of policies) expect(p).toContain("public.has_role(auth.uid(), 'admin'::app_role)");
  });

  it('bucket privado, só PDF e PNG', () => {
    expect(sql).toMatch(/VALUES \('cartoes-leitura', 'cartoes-leitura', false,/);
    expect(sql).toContain("ARRAY['application/pdf', 'image/png']");
  });
});
