import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { _definirConfigParaTestes, _resetarFontes, dadosAtivos } from '../../api/ativa';
import { ErroFonte } from '../../api/fonte';
import { EMAIL, renderDrawer, urlAluno } from './testUtils';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2b', latenciaMs: 0 }); });
afterEach(() => { _resetarFontes(); _definirConfigParaTestes(null); vi.restoreAllMocks(); });

const dialogo = (nome: RegExp | string) => screen.findByRole('dialog', { name: nome }, { timeout: 5000 });

describe('Drawer B2B', () => {
  it('cabeçalho com semestre, IES, participação, grupo, perfil e orientação literal', async () => {
    renderDrawer(urlAluno(EMAIL.bruno));
    const d = await dialogo('Bruno Teles');
    expect(await within(d).findByText('11º semestre · UniAtenas · participou de 4 de 4 simulados')).toBeInTheDocument();
    expect(within(d).getByText('Consistentemente não proficiente')).toBeInTheDocument();
    const orientacao = within(d).getByTestId('orientacao-perfil');
    expect(orientacao).toHaveTextContent('Potencial de virada: conversa individual e plano para o próximo simulado.');
    expect(within(d).getByText('Potencial de virada')).toBeInTheDocument();
    expect(within(d).getByText('BT')).toBeInTheDocument();
  });

  it('sem agenda nem mural no B2B; ações WhatsApp, Criar intervenção e Sinalizar à IES', async () => {
    renderDrawer(urlAluno(EMAIL.bruno));
    const d = await dialogo('Bruno Teles');
    expect(await within(d).findByRole('button', { name: 'Sinalizar à IES' })).toBeEnabled();
    expect(within(d).getByRole('button', { name: 'Criar intervenção' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'WhatsApp' })).toBeDisabled();
    expect(within(d).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(d).queryByText('Mensagem no mural')).not.toBeInTheDocument();
  });

  it('consumo no Flix e simulados do mais recente ao mais antigo com situação', async () => {
    renderDrawer(urlAluno(EMAIL.davi));
    const d = await dialogo('Davi Santana');
    const consumo = await within(d).findByRole('region', { name: 'Consumo no Flix' });
    expect(within(consumo).getByText('Questões feitas')).toBeInTheDocument();
    const sims = within(d).getByRole('region', { name: 'Simulados' });
    const linhas = within(sims).getAllByRole('listitem');
    expect(linhas.map((l) => l.textContent?.match(/\dº Simulado ENAMED/)?.[0])).toEqual(['4º Simulado ENAMED', '3º Simulado ENAMED', '2º Simulado ENAMED', '1º Simulado ENAMED']);
    expect(within(linhas[0]).getByText('—')).toBeInTheDocument();
    expect(within(linhas[0]).getByText('Não participou')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('39')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Abaixo do limiar')).toBeInTheDocument();
    expect(within(linhas[0]).getByText('01/10/2026')).toBeInTheDocument();
  });

  it('proficiente aparece como Proficiente', async () => {
    renderDrawer(urlAluno('amanda.rocha@exemplo.com'));
    const d = await dialogo('Amanda Rocha');
    const sims = await within(d).findByRole('region', { name: 'Simulados' });
    expect(within(sims).getAllByText('Proficiente')).toHaveLength(4);
  });

  it('aluno já sinalizado: botão desabilitado com "Sinalizado à IES"', async () => {
    renderDrawer(urlAluno(EMAIL.davi));
    const d = await dialogo('Davi Santana');
    expect(await within(d).findByRole('button', { name: 'Sinalizado à IES' })).toBeDisabled();
  });

  it('Sinalizar à IES grava a sinalização, vira desabilitado e mostra toast', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(dadosAtivos(), 'sinalizarIes');
    renderDrawer(urlAluno(EMAIL.bruno));
    const d = await dialogo('Bruno Teles');
    await user.click(await within(d).findByRole('button', { name: 'Sinalizar à IES' }));
    expect(await within(d).findByText('Bruno entrou nas sinalizações do comitê.')).toBeInTheDocument();
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Sinalizado à IES' })).toBeDisabled());
    expect(spy).toHaveBeenCalledWith(EMAIL.bruno, 'Potencial de virada');
  });

  it('Criar intervenção leva o perfil para o card', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.bruno));
    const d = await dialogo('Bruno Teles');
    await user.click(await within(d).findByRole('button', { name: 'Criar intervenção' }));
    expect(await within(d).findByText('Intervenção criada em A fazer')).toBeInTheDocument();
    const quadro = await dadosAtivos().intervencoes({ de: null, ate: null });
    const card = quadro.cards.find((c) => c.titulo === 'Acompanhar Bruno');
    expect(card).toMatchObject({ status: 'afazer', perfil: 'virada' });
  });

  it('erro ao sinalizar mostra a mensagem da fonte e mantém o botão ativo', async () => {
    const user = userEvent.setup();
    vi.spyOn(dadosAtivos(), 'sinalizarIes').mockRejectedValueOnce(new ErroFonte(400, 'validacao', 'Aluno já sinalizado neste ciclo'));
    renderDrawer(urlAluno(EMAIL.bruno));
    const d = await dialogo('Bruno Teles');
    await user.click(await within(d).findByRole('button', { name: 'Sinalizar à IES' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Aluno já sinalizado neste ciclo');
    expect(within(d).getByRole('button', { name: 'Sinalizar à IES' })).toBeEnabled();
  });

  it('aluno sem perfil não mostra orientação nem tag de perfil; sem grupo não mostra tag de grupo', async () => {
    renderDrawer(urlAluno('livia.vasconcelos@exemplo.com'));
    const d = await dialogo('Lívia Vasconcelos Teixeira');
    expect(await within(d).findByText(/participou de 0 de 4 simulados/)).toBeInTheDocument();
    expect(within(d).queryByTestId('orientacao-perfil')).not.toBeInTheDocument();
    expect(within(d).queryByText(/Consistentemente|Em variação/)).not.toBeInTheDocument();
  });

  it('erro carrega EstadoErro com retry', async () => {
    vi.spyOn(dadosAtivos(), 'alunoB2b').mockRejectedValue(new ErroFonte(500, 'rede', 'x'));
    renderDrawer(urlAluno(EMAIL.bruno));
    expect(await screen.findByText('Não foi possível carregar o aluno.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });
});
