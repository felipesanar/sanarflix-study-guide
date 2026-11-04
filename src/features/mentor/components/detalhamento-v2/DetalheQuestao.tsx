import * as React from 'react';
import {
  DistribuicaoAlternativas,
  derivarDistratorDominante,
  type ListaRespondentes,
  type RespondentesPorAlternativa,
} from '@/features/gestor/charts/DistribuicaoAlternativas';
import type { Alternativa } from '@/features/gestor/api/types';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { useQuestao, useRespondentesB2b } from '@/features/mentor/api/queries';
import type { QuestaoResumoMentor } from '@/features/mentor/api/types';
import { textoSeguro } from '@/features/mentor/lib/textoSeguro';
import { alternativasDeQuestao, alternativasDeResumo } from './derivar';
import { botaoPrimario, botaoSecundario } from './estilos';

/** Quantos nomes o bloco "Quem marcou X" lista (protótipo: "27 alunos · mostrando 6"). */
export const LIMITE_QUEM_MARCOU = 6;

export interface AcoesQuestao {
  /** Cria card coletivo em "A fazer" (origem questão). */
  onIntervencao: (q: QuestaoResumoMentor) => void;
  /** Abre o mural com os e-mails de quem marcou a alternativa. */
  onMensagem: (q: QuestaoResumoMentor, letra: string, emails: string[]) => void;
  onAbrirAluno: (email: string) => void;
  intervencaoPendente: boolean;
}

function Corpo({
  q, enunciado, imagens, alternativas, respondentes, emailsDe, acoes,
}: {
  q: QuestaoResumoMentor;
  enunciado: string;
  imagens: string[];
  alternativas: Alternativa[];
  respondentes: RespondentesPorAlternativa;
  emailsDe: (letra: string) => string[];
  acoes: AcoesQuestao;
}) {
  const dominante = derivarDistratorDominante(alternativas) ?? null;
  return (
    <div className="flex flex-col gap-3" style={{ border: '1px solid var(--gp-border-strong)', borderRadius: 10, padding: '16px 18px', background: 'var(--gp-surface-1)' }}>
      <p className="whitespace-pre-line" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--gp-text-1)' }}>
        <b>Enunciado.</b> {enunciado || '—'}
      </p>
      {imagens.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {imagens.map((src, i) => (
            <img key={src} src={src} alt={`Imagem ${i + 1} do enunciado da questão ${q.numero ?? ''}`.trim()} className="h-auto max-w-full rounded border border-border sm:max-w-[360px]" />
          ))}
        </div>
      ) : null}
      <DistribuicaoAlternativas
        alternativas={alternativas}
        distratorDominante={dominante ?? undefined}
        respondentes={respondentes}
        abertaInicial={dominante}
        limiteRespondentes={LIMITE_QUEM_MARCOU}
        onAbrirAluno={(id) => acoes.onAbrirAluno(id)}
        acoesRespondentes={(letra: Alternativa['letra'], lista: ListaRespondentes) => (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => acoes.onIntervencao(q)}
              disabled={acoes.intervencaoPendente}
              className="inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
              style={botaoSecundario}
            >
              <Icon name="add" size={13} />
              Criar intervenção
            </button>
            <button
              type="button"
              onClick={() => acoes.onMensagem(q, letra, emailsDe(letra))}
              disabled={lista.total === 0}
              className="inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
              style={botaoPrimario}
            >
              <Icon name="campaign" size={13} />
              Mensagem pra quem marcou {letra}
            </button>
          </div>
        )}
      />
    </div>
  );
}

/** B2C: `mentor_questao` traz enunciado, alternativas e quem marcou cada errada (e-mails). */
export function DetalheQuestaoB2c({
  q, simuladoId, nomeDe, acoes,
}: { q: QuestaoResumoMentor; simuladoId: string; nomeDe: (email: string) => string; acoes: AcoesQuestao }) {
  const r = useQuestao(q.questaoId, [simuladoId]);
  if (r.isLoading) return <GestorSkeleton altura={220} forma="cartao" rotulo="Carregando a questão" />;
  if (r.isError || !r.data) return <EstadoErro titulo="Não foi possível carregar a questão." onRetry={r.refetch} />;
  const questao = r.data;
  const respondentes: RespondentesPorAlternativa = {};
  for (const a of questao.alternativas) {
    if (a.correta || a.emails === null) continue;
    respondentes[a.label.trim().toUpperCase() as Alternativa['letra']] = {
      alunos: a.emails.map((email) => ({ alunoId: email, nome: nomeDe(email) })),
      total: a.n,
    };
  }
  const emailsDe = (letra: string) => questao.alternativas.find((a) => a.label.trim().toUpperCase() === letra)?.emails ?? [];
  return (
    <Corpo
      q={q}
      enunciado={textoSeguro(questao.enunciado)}
      imagens={questao.imagens}
      alternativas={alternativasDeQuestao(questao)}
      respondentes={respondentes}
      emailsDe={emailsDe}
      acoes={acoes}
    />
  );
}

/**
 * B2B: `mentor_questoes_b2b` traz só o início do enunciado e a distribuição; quem marcou vem de
 * `mentor_questao_respondentes_b2b`. Texto das alternativas não existe no contrato B2B (ver relatório).
 */
export function DetalheQuestaoB2b({ q, simuladoId, acoes }: { q: QuestaoResumoMentor; simuladoId: string; acoes: AcoesQuestao }) {
  const r = useRespondentesB2b(q.questaoId, [simuladoId]);
  const alternativas = React.useMemo(() => alternativasDeResumo(q), [q]);
  const respondentes = React.useMemo(() => {
    const mapa: RespondentesPorAlternativa = {};
    for (const alt of alternativas) {
      if (alt.correta) continue;
      const lista = (r.data ?? []).filter((x) => x.alternativa.trim().toUpperCase() === alt.letra);
      mapa[alt.letra] = {
        alunos: lista.map((x) => ({ alunoId: x.email, nome: x.nome ?? x.email })),
        total: q.distribuicao[alt.letra] ?? lista.length,
        carregando: r.isLoading,
        erro: r.isError,
      };
    }
    return mapa;
  }, [alternativas, r.data, r.isLoading, r.isError, q.distribuicao]);
  const emailsDe = (letra: string) => (r.data ?? []).filter((x) => x.alternativa.trim().toUpperCase() === letra).map((x) => x.email);
  return (
    <Corpo
      q={q}
      enunciado={textoSeguro(q.enunciadoInicio)}
      imagens={[]}
      alternativas={alternativas}
      respondentes={respondentes}
      emailsDe={emailsDe}
      acoes={acoes}
    />
  );
}
