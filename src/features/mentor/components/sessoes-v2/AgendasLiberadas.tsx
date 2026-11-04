import { useState } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { mensagemErro } from '../../api/erros';
import { dataHoraSp } from '../../api/fonteAcademy';
import { useConvites, useDesligarAgenda } from '../../api/queries';
import { ddmm, iniciais } from './util';

interface Props {
  nomeDe: (alunoId: string) => string | null;
  onToast: (msg: string) => void;
}

/** B2C: "Agendamento individual liberado para {n} alunos" com switch para desligar (docs/02 § Tela 5). */
export function AgendasLiberadas({ nomeDe, onToast }: Props) {
  const convites = useConvites();
  const desligar = useDesligarAgenda();
  const [desligando, setDesligando] = useState<Set<string>>(new Set());
  const ativos = (convites.data ?? []).filter((c) => c.ativo);
  const n = ativos.length;
  const nome = (c: (typeof ativos)[number]) => c.alunoNome?.trim() || nomeDe(c.alunoId) || c.alunoId;

  async function desligarUm(ids: string[]): Promise<boolean> {
    setDesligando((s) => new Set([...s, ...ids]));
    try {
      for (const id of ids) await desligar.mutateAsync(id);
      return true;
    } catch (e) {
      onToast(mensagemErro(e));
      return false;
    } finally {
      setDesligando((s) => new Set([...s].filter((x) => !ids.includes(x))));
    }
  }

  return (
    <section className="ms-bloco ms-agendas" aria-labelledby="ms-agendas-h">
      <div className="ms-agendas-cab">
        <h2 id="ms-agendas-h">Agendamento individual liberado{convites.isSuccess ? ` para ${n} ${n === 1 ? 'aluno' : 'alunos'}` : ''}</h2>
        {n > 0 && (
          <button type="button" className="ms-btn-texto" disabled={desligando.size > 0}
            onClick={async () => { if (await desligarUm(ativos.map((c) => c.id))) onToast('Agendamento desligado para todos'); }}>
            Desligar todos
          </button>
        )}
      </div>
      {convites.isPending ? (
        <GestorSkeleton altura={120} rotulo="Carregando agendas liberadas" />
      ) : convites.isError ? (
        <EstadoErro descricao={mensagemErro(convites.error)} onRetry={() => void convites.refetch()} tentandoNovamente={convites.isFetching} />
      ) : n === 0 ? (
        <EstadoVazio compacto titulo="Nenhum aluno com agenda liberada." />
      ) : (
        <ul>
          {ativos.map((c) => {
            const quem = nome(c);
            const ocupado = desligando.has(c.id);
            return (
              <li key={c.id} className="ms-agenda">
                <span className="ms-avatar" aria-hidden="true">{iniciais(quem)}</span>
                <span className="ms-agenda-nome">{quem}</span>
                <span className="ms-agenda-desde">
                  desde {ddmm(dataHoraSp(c.liberadoEm).data)}{c.mensagem || c.publicacaoId ? ' · mensagem enviada' : ''}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={true}
                  aria-label={`Agendamento individual de ${quem}`}
                  title="Desligar agendamento"
                  className="ms-switch"
                  disabled={ocupado}
                  aria-busy={ocupado || undefined}
                  onClick={async () => { if (await desligarUm([c.id])) onToast(`Agendamento de ${quem} desligado`); }}
                >
                  <span />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
