/**
 * Drawer do aluno · B2B (docs/03 § Drawer · Aluno; captura b2b/06).
 * Dados: `useAlunoB2b` (TODO(contrato-b2b): formato provisório), `useCronogramaB2b` (datas dos simulados)
 * e `useMe` (nome da IES). Sem agenda individual nem mural (B2B usa Canais).
 */
import * as React from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { linkWhatsAppAluno } from '@/features/gestor/components/DrawerAluno';
import { Tag } from '@/features/gestor/components/Tag';
import { TagGrupo } from '@/features/gestor/components/tabela';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { ehProficiente } from '@/features/gestor/lib/regras';
import { rotuloSituacao } from '@/features/gestor/lib/rotulos';
import { ErroFonte } from '../../api/fonte';
import { mensagemErro } from '../../api/erros';
import { useAlunoB2b, useCronogramaB2b, useMe, useRegistrarEvento, useSinalizarIes } from '../../api/queries';
import type { AlunoB2bDetalhe } from '../../api/types';
import { formatAcertoQuestoes, formatContagem, formatDataSp, ORIENTACAO_PERFIL, primeiroNome, ROTULO_PERFIL, TRACO } from './formatos';
import { AcaoWhatsApp, BotaoAcao, CabecalhoAluno, ConsumoFlix, CorpoDrawer, SkeletonDrawer, TituloOculto } from './partes';

type SimuladoB2b = AlunoB2bDetalhe['simulados'][number];

function situacao(s: SimuladoB2b): { texto: string; cor: string } {
  if (!s.participou) return { texto: rotuloSituacao('nao_participou'), cor: 'var(--gp-text-3)' };
  if (s.proficiencia === null) return { texto: rotuloSituacao('aguardando_resultado'), cor: 'var(--gp-text-3)' };
  return ehProficiente(s.proficiencia)
    ? { texto: rotuloSituacao('proficiente'), cor: 'var(--gp-success-on)' }
    : { texto: rotuloSituacao('abaixo_do_limiar'), cor: 'var(--gp-danger-on)' };
}

export function ConteudoAlunoB2b({ email, mostrarToast }: { email: string; mostrarToast: (t: string) => void }) {
  const me = useMe();
  const detalhe = useAlunoB2b(email);
  const cronograma = useCronogramaB2b();
  const registrar = useRegistrarEvento();
  const sinalizar = useSinalizarIes();
  const [erroAcao, setErroAcao] = React.useState<string | null>(null);
  const [sinalizadoAgora, setSinalizadoAgora] = React.useState(false);
  const idSimulados = React.useId();

  if (detalhe.isError) {
    const e = detalhe.error;
    if (e instanceof ErroFonte && (e.code === 'aluno_fora_da_tribo' || e.status === 404)) {
      return (
        <div className="p-6">
          <TituloOculto titulo="Aluno" descricao="Detalhes do aluno" />
          <EstadoVazio titulo="Aluno não encontrado" descricao={mensagemErro(e)} glifo="groups" />
        </div>
      );
    }
    return (
      <div className="p-6 pt-16">
        <TituloOculto titulo="Aluno" descricao="Detalhes do aluno" />
        <EstadoErro titulo="Não foi possível carregar o aluno." descricao={mensagemErro(e)} tentandoNovamente={detalhe.isFetching} onRetry={detalhe.refetch} />
      </div>
    );
  }
  const d = detalhe.data;
  if (!d || !me.data) return <SkeletonDrawer />;
  const aluno = d.aluno;
  if (!aluno) {
    return (
      <div className="p-6">
        <TituloOculto titulo="Aluno" descricao="Detalhes do aluno" />
        <EstadoVazio titulo="Aluno não encontrado" descricao="Este aluno não está na sua turma." glifo="groups" />
      </div>
    );
  }

  const nome = aluno.nome?.trim() || aluno.email;
  const primeiro = primeiroNome(nome);
  const turmas = me.data.tribos.filter((t) => t.modalidade === 'b2b');
  const turma = turmas.find((t) => t.papel === 'titular') ?? turmas[0];
  const ies = turma?.iesNome ?? turma?.nome ?? null;
  const participou = d.simulados.filter((s) => s.participou).length;
  const linha = [
    aluno.semestre !== null ? `${aluno.semestre}º semestre` : null,
    ies,
    `participou de ${participou} de ${d.simulados.length} simulados`,
  ].filter(Boolean).join(' · ');
  const sinalizado = sinalizadoAgora || !!d.sinalizadoEm || !!aluno.sinalizadoEm;
  const datas = new Map((cronograma.data ?? []).map((s) => [s.id, s.data]));
  const whats = linkWhatsAppAluno(aluno.telefone, `Oi, ${primeiro}! Aqui é seu mentor.`);
  const c = d.consumo30d;
  const consumo = [
    { rotulo: 'Questões feitas', valor: formatContagem(c?.questoes) },
    { rotulo: 'Acerto em questões', valor: formatAcertoQuestoes(c?.acertoQuestoesPct, c?.questoes) },
    { rotulo: 'Aulas assistidas', valor: formatContagem(c?.aulas) },
    { rotulo: 'PDFs', valor: formatContagem(c?.pdfs) },
  ];

  const abrirWhats = () => {
    setErroAcao(null);
    registrar.mutate({ tipo: 'whatsapp_aberto', alunoId: aluno.email }, {
      onSuccess: () => mostrarToast('WhatsApp aberto em nova aba · registrado no log'),
      onError: (e) => setErroAcao(mensagemErro(e)),
    });
  };
  const criarIntervencao = () => {
    setErroAcao(null);
    registrar.mutate({ tipo: 'intervencao_aluno', alunoId: aluno.email, alunoNome: nome, perfil: aluno.perfil }, {
      onSuccess: () => mostrarToast('Intervenção criada em A fazer'),
      onError: (e) => setErroAcao(mensagemErro(e)),
    });
  };
  const sinalizarIes = () => {
    setErroAcao(null);
    const motivo = aluno.perfil ? ROTULO_PERFIL[aluno.perfil] : 'Sinalizado pela mentoria';
    sinalizar.mutate({ email: aluno.email, motivo }, {
      onSuccess: () => { setSinalizadoAgora(true); mostrarToast(`${primeiro} entrou nas sinalizações do comitê.`); },
      onError: (e) => setErroAcao(mensagemErro(e)),
    });
  };

  return (
    <>
      <CabecalhoAluno
        nome={nome}
        linha={linha}
        tags={(aluno.grupo || aluno.perfil) ? <>
          {aluno.grupo && <TagGrupo grupo={aluno.grupo} />}
          {aluno.perfil && <Tag variant="neutro">{ROTULO_PERFIL[aluno.perfil]}</Tag>}
        </> : undefined}
        acoes={<>
          <AcaoWhatsApp href={whats} onAbrir={abrirWhats} />
          <BotaoAcao icone="add" onClick={criarIntervencao} disabled={registrar.isPending}>Criar intervenção</BotaoAcao>
          <BotaoAcao icone="school" onClick={sinalizarIes} disabled={sinalizado || sinalizar.isPending} aria-busy={sinalizar.isPending || undefined}>
            {sinalizado ? 'Sinalizado à IES' : 'Sinalizar à IES'}
          </BotaoAcao>
        </>}
        erroAcao={erroAcao}
      >
        {aluno.perfil && (
          <p data-testid="orientacao-perfil" className="m-0 rounded-[8px] px-3 py-2.5 text-[13px]" style={{ background: 'var(--gp-surface-2)', color: 'var(--gp-text-2)' }}>
            <b style={{ color: 'var(--gp-text-1)' }}>{ROTULO_PERFIL[aluno.perfil]}:</b> {ORIENTACAO_PERFIL[aluno.perfil]}
          </p>
        )}
      </CabecalhoAluno>
      <CorpoDrawer>
        <ConsumoFlix itens={consumo} />
        <section aria-labelledby={idSimulados} className="-mt-2 flex flex-col">
          <h3 id={idSimulados} className="m-0 text-[14px] font-[650]">Simulados</h3>
          {d.simulados.length === 0 ? (
            <span className="py-2 text-[13px]" style={{ color: 'var(--gp-text-2)' }}>Sem simulados ainda.</span>
          ) : (
            <ul className="m-0 list-none p-0">
              {d.simulados.map((s) => {
                const sit = situacao(s);
                const data = datas.get(s.simuladoId) ?? null;
                return (
                  <li key={s.simuladoId} className="flex items-center gap-3 border-b py-2.5" style={{ borderColor: 'var(--gp-border-subtle)' }}>
                    <span className="block min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold">{s.titulo ?? (s.ordem ? `${s.ordem}º Simulado ENAMED` : 'Simulado')}</span>
                      {data && <span className="block text-[12px]" style={{ color: 'var(--gp-text-3)' }}>{formatDataSp(data)}</span>}
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-[17px] font-bold tabular-nums">{s.participou ? formatNumero(s.proficiencia) : TRACO}</span>
                      <span className="whitespace-nowrap text-[11.5px] font-semibold" style={{ color: sit.cor }}>{sit.texto}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </CorpoDrawer>
    </>
  );
}
