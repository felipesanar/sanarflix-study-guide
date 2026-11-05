import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '../../api/erros';
import { useExcluirSessao, useMarcarRealizada } from '../../api/queries';
import type { Sessao } from '../../api/types';
import { ehLinkHttps } from '../../lib/linkSeguro';
import { CampoLinkMeet, GravacaoManual } from './EditoresSessao';
import { ddmm, diaSemana, ehColetiva, linkExibido, paraStatus, podeExcluir, rotuloHora, temaReal, TEMA_A_DEFINIR } from './util';

interface Props {
  sessoes: Sessao[];
  nomeDe: (alunoId: string) => string | null;
  selecionadaId: string | null;
  agora: Date;
  onToast: (msg: string) => void;
  /** Depois de excluir, o foco volta para o bloco (o botão sumiu). */
  onExcluida: () => void;
}

const COLUNAS = ['Data', 'Tipo', 'Com quem', 'Tema', 'Link', 'Após a sessão'];

/** Tabela do B2C (docs/02 § Tela 5): grid CSS que rola dentro do bloco. */
export function TabelaSessoesB2c({ sessoes, nomeDe, selecionadaId, agora, onToast, onExcluida }: Props) {
  return (
    <div className="ms-tabela-scroll">
      <div role="table" aria-label="Sessões" className="ms-tabela">
        <div role="rowgroup">
          <div role="row" className="ms-linha ms-linha-cab">
            {COLUNAS.map((c) => <span key={c} role="columnheader">{c}</span>)}
          </div>
        </div>
        <div role="rowgroup">
          {sessoes.map((s) => (
            <LinhaSessaoB2c key={s.id} sessao={s} nome={s.alunoId ? nomeDe(s.alunoId) ?? s.alunoId : null}
              selecionada={s.id === selecionadaId} agora={agora} onToast={onToast} onExcluida={onExcluida} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LinhaSessaoB2c({ sessao: s, nome, selecionada, agora, onToast, onExcluida }: {
  sessao: Sessao; nome: string | null; selecionada: boolean; agora: Date; onToast: (m: string) => void; onExcluida: () => void;
}) {
  const marcar = useMarcarRealizada();
  const excluir = useExcluirSessao();
  const coletiva = ehColetiva(s.tipo);
  const status = paraStatus(s);
  const realizada = s.status === 'realizada';
  const quem = coletiva ? 'Tribo toda' : nome ?? '—';
  const quando = `${diaSemana(s.data)} ${ddmm(s.data)}`;

  async function marcarFeita() {
    try {
      await marcar.mutateAsync(s.id);
      onToast(`Sessão com ${quem} marcada como feita. Card movido para Feito.`);
    } catch (e) { onToast(mensagemErro(e)); }
  }
  async function excluirSessao() {
    try {
      await excluir.mutateAsync(s.id);
      // A RPC retira o aviso do mural; card e log ficam (docs/05 § CRUD).
      onToast(coletiva ? 'Sessão excluída · aviso retirado do mural da tribo' : 'Sessão excluída');
      onExcluida();
    } catch (e) { onToast(mensagemErro(e)); }
  }

  return (
    <div role="row" className="ms-linha" data-selecionada={selecionada || undefined} data-testid={`sessao-${s.id}`}>
      <span role="cell" className="ms-data"><b>{quando}</b><span>{rotuloHora(s.hora)}</span></span>
      <span role="cell" className="ms-tipo">
        <Icon name={coletiva ? 'groups' : 'account_circle'} size={14} />
        {coletiva ? 'Encontro da tribo' : 'Individual'}
      </span>
      <span role="cell">{quem}</span>
      <span role="cell">{temaReal(s) ?? TEMA_A_DEFINIR}</span>
      <span role="cell" className="ms-link">
        {!coletiva ? (
          <span className="ms-link-agenda" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="calendar_month" size={13} />agenda do mentor</span>
        ) : status === 'falta_link' || status === 'falta_link_e_pauta' ? (
          <span className="ms-inline" style={{ minWidth: 0, overflow: 'visible', whiteSpace: 'normal' }}>
            <span className="ms-link-falta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="report_problem" size={13} />Falta link</span>
            <CampoLinkMeet sessao={s} modo="compacto" onToast={onToast} />
          </span>
        ) : s.link && ehLinkHttps(s.link) ? (
          <a className="ms-link-ok" href={s.link} target="_blank" rel="noopener noreferrer" title={s.link} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="open_in_new" size={13} />{linkExibido(s.link)}
          </a>
        ) : (
          <span className="ms-meta">—</span>
        )}
      </span>
      <span role="cell" className="ms-apos">
        {!realizada && !coletiva && (
          <button type="button" className="ms-btn-linha" onClick={() => void marcarFeita()} disabled={marcar.isPending} aria-busy={marcar.isPending || undefined}
            aria-label={`Marcar feita a sessão com ${quem} de ${quando}`}>
            <Icon name="check" size={14} />Marcar feita
          </button>
        )}
        {!realizada && coletiva && <span>grava para o acervo</span>}
        {realizada && coletiva && (s.gravacaoUrl ? <span>No acervo de mentorias</span> : <><span>Aguardando gravação</span><GravacaoManual sessao={s} onToast={onToast} /></>)}
        {realizada && !coletiva && <span>Feita · não vai para o acervo</span>}
        {podeExcluir(s, agora) && (
          <button type="button" className="ms-btn-icone" onClick={() => void excluirSessao()} disabled={excluir.isPending} aria-busy={excluir.isPending || undefined}
            aria-label={`Excluir sessão de ${quando}`} title="Excluir sessão">
            <Icon name="close" size={13} />
          </button>
        )}
      </span>
    </div>
  );
}
