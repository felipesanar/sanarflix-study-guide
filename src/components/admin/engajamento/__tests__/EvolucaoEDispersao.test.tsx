import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { abreviarIes, DispersaoEngajamentoAcerto } from '@/components/admin/engajamento/DispersaoEngajamentoAcerto';
import { EvolucaoRede } from '@/components/admin/engajamento/EvolucaoRede';
import { adminEngajamento } from '@/features/gestor/__tests__/fixtures/engajamento/admin';

/** Evolução da rede e Dispersão engajamento × acerto do admin (spec §10.6, §12.5). */

const montarEvolucao = (semestre: number | null = null, onSemestre = vi.fn()) => {
  const d = adminEngajamento();
  render(<EvolucaoRede meses={d.meses} semestres={d.semestres} fim="2026-10-22" semestre={semestre} onSemestre={onSemestre} />);
  return onSemestre;
};

const escolher = (id: string) => fireEvent.change(screen.getByLabelText('Indicador'), { target: { value: id } });
const mensal = () => within(screen.getByTestId('evolucao-mensal'));
const semestral = () => within(screen.getByTestId('evolucao-semestre'));

describe('EvolucaoRede (§12.5)', () => {
  it('título, descrição e o seletor "Indicador" com os 5 indicadores; padrão Questões', () => {
    montarEvolucao();
    expect(screen.getByRole('heading', { level: 2, name: 'Evolução da rede' })).toBeInTheDocument();
    expect(screen.getByText('Escolha o indicador · o gráfico ao lado mostra o mesmo indicador por semestre')).toBeInTheDocument();
    const seletor = screen.getByLabelText('Indicador');
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Questões', '% de acerto', 'Conteúdos', 'Vídeos', 'Documentos']);
    expect(seletor).toHaveValue('questoes');
  });

  it.each([
    ['questoes', 'Questões resolvidas', 'Total de questões resolvidas na rede', 'Total resolvido por alunos de cada semestre'],
    ['acerto', '% de acerto', 'Acerto médio da rede (eixo de 60% a 75%)', 'Acerto médio por semestre (barra cheia = 100%)'],
    ['conteudos', 'Conteúdos consumidos', 'Vídeos + documentos abertos na rede', 'Vídeos + documentos abertos por alunos de cada semestre'],
    ['videos', 'Vídeos', 'Vídeos abertos na rede', 'Vídeos abertos por alunos de cada semestre'],
    ['documentos', 'Documentos', 'Documentos abertos na rede', 'Documentos abertos por alunos de cada semestre'],
  ])('indicador %s: títulos e descrições da §12.5', (id, nome, descMes, descSem) => {
    montarEvolucao();
    escolher(id);
    expect(mensal().getByRole('heading', { level: 3, name: `${nome} por mês` })).toBeInTheDocument();
    expect(mensal().getByText(`${descMes} · outubro parcial, até 22/10`)).toBeInTheDocument();
    expect(semestral().getByRole('heading', { level: 3, name: `${nome} por semestre` })).toBeInTheDocument();
    expect(semestral().getByText(`${descSem} · clique num semestre para filtrar a página`)).toBeInTheDocument();
  });

  it('com semestre filtrado, a descrição mensal ganha " · só {n}º semestre" antes do mês parcial', () => {
    montarEvolucao(8);
    expect(mensal().getByText('Total de questões resolvidas na rede · só 8º semestre · outubro parcial, até 22/10')).toBeInTheDocument();
  });

  it('sem mês parcial no fim, não cita parcial', () => {
    const d = adminEngajamento();
    d.meses = d.meses.map((m) => ({ ...m, parcial: false }));
    render(<EvolucaoRede meses={d.meses} semestres={d.semestres} fim="2026-10-22" semestre={null} onSemestre={vi.fn()} />);
    expect(mensal().getByText('Total de questões resolvidas na rede')).toBeInTheDocument();
  });

  it('gráfico mensal: figura acessível com tabela, mês parcial "Out*" e valores formatados', () => {
    montarEvolucao();
    const figura = mensal().getByRole('img', { name: 'Questões resolvidas por mês' }).closest('figure') as HTMLElement;
    expect(within(figura).getByText('Ver dados em tabela')).toBeInTheDocument();
    const linhas = within(figura).getAllByRole('row');
    expect(linhas).toHaveLength(7);
    expect(within(linhas[6]).getByRole('rowheader')).toHaveTextContent('Out*');
    expect(within(linhas[6]).getByRole('cell')).toHaveTextContent('36.000');
    expect(within(figura).getAllByTestId('rede-ponto').map((p) => p.getAttribute('data-parcial'))).toEqual(['false', 'false', 'false', 'false', 'false', 'true']);
    expect(within(figura).getByTestId('rede-serie')).toBeInTheDocument();
  });

  it('eixo de quantidade: Questões em múltiplos de 1.000 e Vídeos em múltiplos de 500', () => {
    montarEvolucao();
    const g = mensal().getByRole('img', { name: 'Questões resolvidas por mês' });
    expect(within(g).getByText('58.000')).toBeInTheDocument(); // 50.000 × 1,15 = 57.500 → 58.000
    escolher('videos');
    const v = mensal().getByRole('img', { name: 'Vídeos por mês' });
    expect(within(v).getByText('4.500')).toBeInTheDocument(); // 3.500 × 1,15 = 4.025 → 4.500
  });

  it('gráfico por semestre: as 12 barras são botões com aria-pressed e "—" onde não há dado', () => {
    montarEvolucao();
    escolher('acerto');
    const botoes = semestral().getAllByRole('button');
    expect(botoes).toHaveLength(12);
    expect(semestral().getByRole('button', { name: '1º semestre: 60%' })).toHaveAttribute('aria-pressed', 'false');
    expect(semestral().getByRole('button', { name: '9º semestre: —' })).toBeInTheDocument();
  });

  it('clicar num semestre filtra a página; clicar no selecionado limpa (toggle)', () => {
    const onSemestre = montarEvolucao();
    fireEvent.click(semestral().getByRole('button', { name: /^8º semestre/ }));
    expect(onSemestre).toHaveBeenLastCalledWith(8);
  });

  it('semestre selecionado: aria-pressed e clique devolve null', () => {
    const onSemestre = montarEvolucao(8);
    const b = semestral().getByRole('button', { name: /^8º semestre/ });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(b);
    expect(onSemestre).toHaveBeenLastCalledWith(null);
  });

  it('modo % de acerto: barra cheia = 100% (a de 69% ocupa 69% da altura)', () => {
    montarEvolucao();
    escolher('acerto');
    const barras = semestral().getAllByTestId('rede-barra-semestre');
    expect(barras[0].style.height).toBe(`${Math.round(0.6 * 140)}px`);
    expect(barras[8].style.height).toBe('0px'); // sem acerto
  });

  it('só tema geral do console: nenhum token do portal do gestor nem cor literal', () => {
    montarEvolucao();
    const html = screen.getByTestId('evolucao-rede').innerHTML;
    expect(html).not.toContain('--gp-');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});

describe('abreviarIes (§10.6)', () => {
  it('"Faculdade " → "Fac. " e "Centro Univ. " → "CU "; os demais ficam', () => {
    expect(abreviarIes('Faculdade Beta de Medicina')).toBe('Fac. Beta de Medicina');
    expect(abreviarIes('Centro Univ. Gama')).toBe('CU Gama');
    expect(abreviarIes('PARACATU')).toBe('PARACATU');
  });
});

describe('DispersaoEngajamentoAcerto (§10.6, §12.5)', () => {
  const montar = (mutar?: (d: ReturnType<typeof adminEngajamento>) => void) => {
    const d = adminEngajamento();
    mutar?.(d);
    render(<DispersaoEngajamentoAcerto ranking={d.ranking} rede={d.rede} />);
    return d;
  };

  it('título, descrição e os eixos com min e max nas pontas', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Engajamento × acerto' })).toBeInTheDocument();
    expect(screen.getByText('Tamanho do ponto = base ativa. Linhas tracejadas = médias da rede.')).toBeInTheDocument();
    expect(screen.getByText('% de acerto')).toBeInTheDocument();
    expect(screen.getByText('% engajados →')).toBeInTheDocument();
    // x: engajados 60–63,3 (média 60) → 55% a 70%; y: acerto 66,4–70,1 (média 66,4) → 60% a 80%
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('uma bolha por IES com acerto; a sem acerto fica fora do desenho', () => {
    montar();
    expect(screen.getAllByTestId('bolha-ies')).toHaveLength(2);
    expect(screen.getAllByTestId('bolha-ies').map((b) => b.textContent)).not.toContain('CU Gama');
  });

  it('rótulos abreviados nas bolhas', () => {
    montar();
    const bolhas = screen.getAllByTestId('bolha-ies').map((b) => b.textContent);
    expect(bolhas).toEqual(['PARACATU', 'Fac. Beta de Medicina']);
  });

  it('raio = 8 + 22 × base ÷ maiorBase: a maior base tem 30px de raio', () => {
    montar();
    const [paracatu, beta] = screen.getAllByTestId('bolha-circulo');
    expect(paracatu.style.width).toBe('60px'); // 2 × (8 + 22)
    expect(parseFloat(beta.style.width)).toBeCloseTo(2 * (8 + (22 * 300) / 521), 5);
  });

  it('linhas tracejadas nas médias da rede', () => {
    montar();
    expect(screen.getByTestId('media-x')).toBeInTheDocument();
    expect(screen.getByTestId('media-y')).toBeInTheDocument();
    expect(screen.getByTestId('media-x').className).toContain('border-dashed');
  });

  it('figura acessível: tabela com todas as IES, "—" para a que não tem acerto', () => {
    montar();
    const figura = screen.getByRole('img', { name: 'Engajamento × acerto por instituição' }).closest('figure') as HTMLElement;
    expect(within(figura).getByText('Ver dados em tabela')).toBeInTheDocument();
    const linhas = within(figura).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(3);
    expect(within(linhas[0]).getByRole('cell')).toHaveTextContent('63% engajados · acerto 66%');
    expect(within(linhas[2]).getByRole('rowheader')).toHaveTextContent('Centro Univ. Gama');
    expect(within(linhas[2]).getByRole('cell')).toHaveTextContent('45% engajados · acerto —');
  });

  it('com uma só IES desenhável ou nenhuma, não quebra', () => {
    montar((d) => {
      d.ranking = d.ranking.map((l) => ({ ...l, acertoPct: null }));
    });
    expect(screen.queryAllByTestId('bolha-ies')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Engajamento × acerto por instituição' })).toBeInTheDocument();
  });

  it('só tema geral do console', () => {
    montar();
    const html = screen.getByTestId('dispersao').innerHTML;
    expect(html).not.toContain('--gp-');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
