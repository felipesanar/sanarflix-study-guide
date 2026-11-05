import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { mensagemErro } from '../../api/erros';
import { useEditarSessao, useExcluirSessao, useMarcarRealizada } from '../../api/queries';
import type { ItemPauta, Sessao, StatusSessaoExibido, TipoSessao } from '../../api/types';
import { ehLinkHttps } from '../../lib/linkSeguro';
import { CampoLinkMeet, GravacaoManual } from './EditoresSessao';
import { ddmm, diaSemana, ehColetiva, linkExibido, paraStatus, pautaParaSalvar, podeExcluir, rotuloHora, subtituloB2b, temaReal, TEMA_A_DEFINIR } from './util';

export const TIPO_B2B: Record<TipoSessao, { rotulo: string; icone: DendeIconName }> = {
  pos_simulado: { rotulo: 'Pós-simulado', icone: 'quiz' },
  oficina: { rotulo: 'Oficina de questões', icone: 'auto_stories' },
  individual: { rotulo: 'Individual', icone: 'account_circle' },
  encontro_tribo: { rotulo: 'Encontro da tribo', icone: 'groups' },
};
export const STATUS_B2B: Record<StatusSessaoExibido, { rotulo: string; icone: DendeIconName; tom: 'neutro' | 'pendencia' | 'realizada' }> = {
  agendada: { rotulo: 'Agendada', icone: 'schedule', tom: 'neutro' },
  falta_link: { rotulo: 'Falta link', icone: 'report_problem', tom: 'pendencia' },
  pauta_pendente: { rotulo: 'Pauta pendente', icone: 'report_problem', tom: 'pendencia' },
  falta_link_e_pauta: { rotulo: 'Falta link e pauta', icone: 'report_problem', tom: 'pendencia' },
  realizada: { rotulo: 'Realizada', icone: 'check', tom: 'realizada' },
};
const PAUTA: Record<ItemPauta['origem'], { origem: string; icone: DendeIconName }> = {
  tema_critico: { origem: 'tema crítico', icone: 'flag' },
  mais_erradas: { origem: 'Detalhamento', icone: 'quiz' },
  livre: { origem: 'livre', icone: 'mode_edit' },
};

interface Props {
  sessoes: Sessao[];
  abertaId: string | null;
  onAlternar: (id: string) => void;
  nomeDe: (alunoId: string) => string | null;
  agendaLiberada: (alunoId: string) => boolean;
  agora: Date;
  onToast: (msg: string) => void;
  onExcluida: () => void;
}

/** Lista expansível do B2B (docs/03 § Tela 4), já em ordem cronológica. */
export function ListaSessoesB2b({ sessoes, abertaId, onAlternar, ...resto }: Props) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }} aria-label="Sessões">
      {sessoes.map((s) => (
        <SessaoB2b key={s.id} sessao={s} aberta={s.id === abertaId} onAlternar={() => onAlternar(s.id)} {...resto} />
      ))}
    </ul>
  );
}

function SessaoB2b({ sessao: s, aberta, onAlternar, nomeDe, agendaLiberada, agora, onToast, onExcluida }: Omit<Props, 'sessoes' | 'abertaId' | 'onAlternar'> & {
  sessao: Sessao; aberta: boolean; onAlternar: () => void;
}) {
  const editar = useEditarSessao();
  const marcar = useMarcarRealizada();
  const excluir = useExcluirSessao();
  const coletiva = ehColetiva(s.tipo);
  const realizada = s.status === 'realizada';
  const status = STATUS_B2B[paraStatus(s)];
  const tipo = TIPO_B2B[s.tipo];
  const nome = s.alunoId ? nomeDe(s.alunoId) ?? s.alunoId : null;
  const corpoId = `ms-sessao-${s.id}`;
  const linkOk = !!s.link && ehLinkHttps(s.link);

  async function removerItem(item: ItemPauta) {
    try {
      await editar.mutateAsync({ id: s.id, mudancas: { pauta: pautaParaSalvar(s.pauta.filter((p) => p.id !== item.id)) } });
      onToast('Item removido da pauta');
    } catch (e) { onToast(mensagemErro(e)); }
  }
  async function marcarRealizada() {
    try {
      await marcar.mutateAsync(s.id);
      onToast('Sessão marcada como realizada · card em Feito');
    } catch (e) { onToast(mensagemErro(e)); }
  }
  async function excluirSessao() {
    try {
      await excluir.mutateAsync(s.id);
      onToast(coletiva ? 'Sessão excluída · aviso retirado do mural' : 'Sessão excluída');
      onExcluida();
    } catch (e) { onToast(mensagemErro(e)); }
  }

  return (
    <li className="ms-sessao" data-aberta={aberta || undefined} data-testid={`sessao-${s.id}`}>
      <button type="button" className="ms-sessao-gatilho" aria-expanded={aberta} aria-controls={aberta ? corpoId : undefined} onClick={onAlternar}>
        <span style={{ display: 'block' }}>
          <span className="ms-dia">{diaSemana(s.data)}</span>
          <span className="ms-num">{ddmm(s.data)}</span>
          <span className="ms-dia" style={{ fontSize: 12 }}>{rotuloHora(s.hora)}</span>
        </span>
        <span className="ms-tipo-b2b"><Icon name={tipo.icone} size={15} />{tipo.rotulo}</span>
        <span className="ms-tema">
          <span>{temaReal(s) ?? TEMA_A_DEFINIR}</span>
          <span>{subtituloB2b(s, nome, !!s.alunoId && agendaLiberada(s.alunoId))}</span>
        </span>
        <span className="ms-status" data-tom={status.tom}><Icon name={status.icone} size={14} />{status.rotulo}</span>
        <Icon name={aberta ? 'expand_less' : 'expand_more'} size={16} />
      </button>
      {aberta && (
        <div id={corpoId} className="ms-sessao-corpo" role="region" aria-label={`${tipo.rotulo} de ${ddmm(s.data)}`}>
          {coletiva && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="ms-pauta-titulo" id={`${corpoId}-pauta`}>Pauta</span>
              {s.pauta.length === 0 ? (
                <span className="ms-meta" style={{ fontSize: 12.5 }}>Sem itens na pauta.</span>
              ) : (
                <ul className="ms-pauta" aria-labelledby={`${corpoId}-pauta`}>
                  {s.pauta.map((p) => (
                    <li key={p.id} className="ms-pauta-item">
                      <Icon name={PAUTA[p.origem].icone} size={14} />
                      <span>{p.texto}</span>
                      <span className="ms-pauta-origem">{PAUTA[p.origem].origem}</span>
                      {!realizada && (
                        <button type="button" className="ms-pauta-remover" aria-label={`Remover da pauta: ${p.texto}`} title="Remover da pauta"
                          onClick={() => void removerItem(p)} disabled={editar.isPending}>
                          <Icon name="close" size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="ms-acoes-sessao">
            {coletiva && !realizada && !linkOk && <CampoLinkMeet sessao={s} modo="aberto" onToast={onToast} />}
            {coletiva && linkOk && (
              <a className="ms-link-ok ms-link" href={s.link!} target="_blank" rel="noopener noreferrer" title={s.link!}>
                <Icon name="open_in_new" size={13} /><span>{linkExibido(s.link!)}</span>
              </a>
            )}
            {!realizada && (!coletiva || linkOk) && (
              <button type="button" className="ms-btn-linha" onClick={() => void marcarRealizada()} disabled={marcar.isPending} aria-busy={marcar.isPending || undefined}>
                <Icon name="check" size={14} />Marcar realizada
              </button>
            )}
            {realizada && (
              <span className="ms-apos">
                {!coletiva ? 'Individual não vai para o acervo' : s.gravacaoUrl ? 'No acervo de mentorias' : 'Aguardando gravação'}
              </span>
            )}
            {realizada && coletiva && !s.gravacaoUrl && <GravacaoManual sessao={s} onToast={onToast} />}
            {podeExcluir(s, agora) && (
              <button type="button" className="ms-btn-linha" onClick={() => void excluirSessao()} disabled={excluir.isPending} aria-busy={excluir.isPending || undefined}>
                <Icon name="close" size={14} />Excluir sessão
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
