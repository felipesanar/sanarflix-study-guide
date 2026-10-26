import * as React from 'react';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CabecalhoTela, ContainerRota } from '@/features/gestor/components/CabecalhoTela';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { AbasEngajamento } from '@/features/gestor/components/engajamento/AbasEngajamento';
import { BotaoExportarAba } from '@/features/gestor/components/engajamento/BotaoExportarAba';
import { FaixaFiltroPagina } from '@/features/gestor/components/engajamento/FaixaFiltroPagina';
import { FiltroPeriodo } from '@/features/gestor/components/engajamento/FiltroPeriodo';
import { FiltroSemestreEngajamento } from '@/features/gestor/components/engajamento/FiltroSemestreEngajamento';
import { useEngajamentoVisaoGeral } from '@/features/gestor/api/engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { formatarAtualizadoEm } from '@/features/gestor/lib/engajamento';

const ROTA_VISAO_GERAL = '/gestor/engajamento';

/**
 * Casca do Engajamento SanarFlix (spec 2026-10-22-engajamento §9.1, §11, §12.1):
 * breadcrumb, título, subtítulo, filtros de período e de semestre, "Exportar",
 * abas e a faixa "Página filtrada por".
 *
 * A visão geral é consultada AQUI, nas três abas (§9.1): dela saem o nome da IES,
 * o "atualizado em" e o `temDados`. A rota da Visão geral usa o mesmo hook com os
 * mesmos filtros, então as duas partilham a mesma entrada de cache.
 *
 * Instituição sem alunos na base ativa (`temDados === false`): o conteúdo das
 * três abas dá lugar a um estado vazio; cabeçalho, filtros e abas continuam.
 * Erro ou carregamento da visão geral NÃO derrubam o layout: cada bloco da aba
 * trata o seu próprio estado.
 */
export default function EngajamentoLayout() {
  const filtros = useFiltrosEngajamento();
  const { pathname } = useLocation();
  const visao = useEngajamentoVisaoGeral(filtros);

  const dados = visao.data;
  const naVisaoGeral = pathname.replace(/\/+$/, '') === ROTA_VISAO_GERAL;

  const atualizadoEm = formatarAtualizadoEm(visao.meta?.atualizadoEm);
  const apoio = dados
    ? `Vídeos, documentos e questões dos alunos da ${dados.ies.nome} · ${
        atualizadoEm ? `atualizado em ${atualizadoEm}` : 'atualização pendente'
      }`
    : undefined;

  // O aluno só vale se o dado em tela é o dele (placeholderData pode trazer o anterior).
  const alunoDoRecorte =
    filtros.alunoId !== null && dados?.recorte.aluno?.id === filtros.alunoId ? dados.recorte.aluno : null;

  return (
    <ContainerRota data-testid="engajamento-layout">
      <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
        Uso da plataforma / Engajamento
      </p>

      <CabecalhoTela
        titulo="Engajamento no SanarFlix"
        apoio={apoio}
        acoes={
          <>
            <FiltroPeriodo filtros={filtros} />
            <FiltroSemestreEngajamento filtros={filtros} />
            <BotaoExportarAba />
          </>
        }
      >
        <AbasEngajamento />
      </CabecalhoTela>

      {naVisaoGeral ? (
        <FaixaFiltroPagina
          aluno={alunoDoRecorte}
          semestre={filtros.alunoId === null ? filtros.semestre : null}
          onLimpar={filtros.limparFiltroPagina}
        />
      ) : null}

      {dados?.temDados === false ? (
        <EstadoVazio
          titulo="Ainda não há dados do SanarFlix para esta instituição."
          descricao="Os dados aparecem aqui assim que os alunos da instituição começarem a usar o SanarFlix."
        />
      ) : (
        // Suspense próprio: trocar de aba não pode devolver a página inteira ao esqueleto do shell.
        <Suspense fallback={<GestorSkeleton altura={320} forma="cartao" rotulo="Carregando Engajamento" />}>
          <Outlet />
        </Suspense>
      )}
    </ContainerRota>
  );
}
