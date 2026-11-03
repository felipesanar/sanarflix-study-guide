import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ordenarRanking, RankingIes } from '@/components/admin/engajamento/RankingIes';
import { adminEngajamento } from '@/features/gestor/__tests__/fixtures/engajamento/admin';

/** Ranking de IES do admin (spec 2026-10-22-engajamento §12.5, P14). */

const montar = (d = adminEngajamento()) =>
  render(
    <MemoryRouter>
      <RankingIes ranking={d.ranking} rede={d.rede} />
    </MemoryRouter>,
  );

const nomes = () => screen.getAllByTestId('linha-ranking').map((l) => within(l).getByRole('rowheader').textContent);
const linha = (nome: string) => screen.getAllByTestId('linha-ranking').find((l) => within(l).getByRole('rowheader').textContent === nome) as HTMLElement;

describe('RankingIes', () => {
  it('título, "Ordenar por:" e os 3 critérios; o padrão é Engajamento', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Ranking de IES' })).toBeInTheDocument();
    expect(screen.getByText('Ordenar por:')).toBeInTheDocument();
    const grupo = screen.getByRole('group', { name: 'Ordenar ranking por' });
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Engajamento', 'Acerto', 'Base ativa']);
    expect(within(grupo).getByRole('button', { name: 'Engajamento' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('colunas na ordem da spec, com "Ações" só para leitor de tela', () => {
    montar();
    const tabela = screen.getByRole('table', { name: 'Ranking de IES' });
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      '#', 'Instituição', 'Base ativa', 'Engajados', '% Alunos proficientes*', 'Sumidos 30+d', 'Vídeos / aluno', 'Questões / aluno', 'Acerto', 'Tendência', 'Ações',
    ]);
    expect(within(tabela).getByText('Ações')).toHaveClass('sr-only');
  });

  it('ordem padrão por engajamento, decrescente; empate pelo nome; posição renumerada', () => {
    montar();
    // PARACATU e Faculdade Beta empatam em 63,3%: nome asc
    expect(nomes()).toEqual(['Faculdade Beta de Medicina', 'PARACATU', 'Centro Univ. Gama']);
    expect(screen.getAllByTestId('linha-ranking').map((l) => within(l).getAllByRole('cell')[0].textContent)).toEqual(['1', '2', '3']);
  });

  it('Acerto: decrescente, e IES sem acerto vai para o fim', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Acerto' }));
    expect(nomes()).toEqual(['Faculdade Beta de Medicina', 'PARACATU', 'Centro Univ. Gama']);
    expect(screen.getByRole('button', { name: 'Acerto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Engajamento' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Base ativa: decrescente pela base', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Base ativa' }));
    expect(nomes()).toEqual(['PARACATU', 'Faculdade Beta de Medicina', 'Centro Univ. Gama']);
    expect(screen.getAllByTestId('linha-ranking').map((l) => within(l).getAllByRole('cell')[0].textContent)).toEqual(['1', '2', '3']);
  });

  it('ordenarRanking não muda o array de entrada', () => {
    const d = adminEngajamento();
    const antes = d.ranking.map((l) => l.nome);
    ordenarRanking(d.ranking, 'base');
    expect(d.ranking.map((l) => l.nome)).toEqual(antes);
  });

  it('proficiência: "{x}%" com o simulado e "mmm/aa"; sem simulado, "—" e "sem simulado ENAMED"', () => {
    montar();
    const paracatu = linha('PARACATU');
    expect(within(paracatu).getByTestId('proficiencia-valor')).toHaveTextContent('75%');
    expect(paracatu).toHaveTextContent('UNIATENAS - 10/09/26 · set/26');
    const gama = linha('Centro Univ. Gama');
    expect(within(gama).getByTestId('proficiencia-valor')).toHaveTextContent('—');
    expect(gama).toHaveTextContent('sem simulado ENAMED');
  });

  it('proficiência abaixo de 40% em text-destructive', () => {
    montar();
    expect(within(linha('Faculdade Beta de Medicina')).getByTestId('proficiencia-valor')).toHaveClass('text-destructive');
    expect(within(linha('PARACATU')).getByTestId('proficiencia-valor')).not.toHaveClass('text-destructive');
  });

  it('"Sumidos 30+d" em destaque só quando acima do % da rede (25,0%)', () => {
    montar();
    expect(within(linha('Faculdade Beta de Medicina')).getByTestId('sumidos-30')).toHaveClass('text-destructive'); // 30,0%
    expect(within(linha('PARACATU')).getByTestId('sumidos-30')).toHaveClass('text-destructive'); // 25,5%
    expect(within(linha('Centro Univ. Gama')).getByTestId('sumidos-30')).not.toHaveClass('text-destructive'); // 18,0%
  });

  it('tendência: ▲/▼ em p.p.; sem anterior, "—"; sem verde', () => {
    montar();
    expect(within(linha('Faculdade Beta de Medicina')).getByText('▲ 6 p.p.')).toHaveClass('text-foreground');
    const gama = within(linha('Centro Univ. Gama')).getByText('▼ 5 p.p.');
    expect(gama).toHaveClass('text-destructive');
    const paracatu = linha('PARACATU');
    expect(within(paracatu).getAllByRole('cell').at(-2)).toHaveTextContent('—');
    expect(screen.getByTestId('ranking-ies').innerHTML).not.toMatch(/green|emerald/);
  });

  it('engajados: barra com o traço da média da rede e o percentual', () => {
    montar();
    const l = linha('PARACATU');
    expect(within(l).getByTestId('traco-media-rede').style.left).toBe('60%');
    expect(l).toHaveTextContent('63%');
  });

  it('demais colunas: base, vídeos / aluno (1 casa), questões / aluno e acerto, com "—" onde falta', () => {
    montar();
    const cel = (nome: string) => within(linha(nome)).getAllByRole('cell').map((c) => c.textContent);
    expect(cel('PARACATU')[1]).toBe('521');
    expect(cel('PARACATU').slice(4, 8)).toEqual(['26%', '42,2', '442', '66%']);
    expect(cel('Centro Univ. Gama').slice(4, 8)).toEqual(['18%', '—', '—', '—']);
  });

  it('"Abrir portal →" leva para o portal do gestor daquela IES', () => {
    montar();
    const link = within(linha('PARACATU')).getByRole('link', { name: /Abrir portal/ });
    expect(link).toHaveTextContent('Abrir portal →');
    expect(link).toHaveAttribute('href', '/gestor/engajamento?ies=ies-paracatu');
  });

  it('os dois rodapés literais', () => {
    montar();
    expect(
      screen.getByText('Traço preto = média da rede (60%). Tendência = variação do engajamento vs. o período anterior de mesma duração.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '* % de alunos proficientes no simulado mais recente que a IES realizou conosco (nome e data abaixo do valor). Por isso as IES podem estar comparadas em simulados diferentes. Esse número não muda com o filtro de semestre nem de período.',
      ),
    ).toBeInTheDocument();
  });

  it('nenhum dado individual de aluno na tabela', () => {
    montar();
    expect(screen.getByTestId('ranking-ies').innerHTML).not.toMatch(/@|sanarflix_user_id/);
  });

  it('usa só o tema geral do console, sem tokens do portal do gestor', () => {
    montar();
    expect(screen.getByTestId('ranking-ies').innerHTML).not.toContain('--gp-');
  });
});
