/**
 * Deep links que saem do Início (docs/06 § Estado de UI por tela). Os parâmetros são o contrato com as telas
 * de destino: Minha Turma lê `alerta`, Visão Geral lê `perfil`, Detalhamento lê `s`, Sessões lê `sessao`,
 * Intervenções lê `card` (drawer aberto) e `novo=1` (formulário aberto).
 */
import type { AlertaB2C, GrupoPrioridadeB2B } from '../../api/types';

const q = (chave: string, valor: string) => `${chave}=${encodeURIComponent(valor)}`;

export const linksInicio = {
  turmaPorAlerta: (alerta: AlertaB2C) => `/mentor/turma?${q('alerta', alerta)}`,
  turma: () => '/mentor/turma',
  visaoGeral: () => '/mentor/visao-geral',
  visaoGeralPorPerfil: (perfil: GrupoPrioridadeB2B) => `/mentor/visao-geral?${q('perfil', perfil)}`,
  detalhamento: (simuladoId: string | null) => (simuladoId ? `/mentor/detalhamento?${q('s', simuladoId)}` : '/mentor/detalhamento'),
  sessoes: () => '/mentor/sessoes',
  sessao: (id: string | null | undefined) => (id ? `/mentor/sessoes?${q('sessao', id)}` : '/mentor/sessoes'),
  intervencoes: () => '/mentor/intervencoes',
  novaIntervencao: () => '/mentor/intervencoes?novo=1',
  card: (id: string) => `/mentor/intervencoes?${q('card', id)}`,
  mural: () => '/mentor/mural',
  canais: () => '/mentor/canais',
};
