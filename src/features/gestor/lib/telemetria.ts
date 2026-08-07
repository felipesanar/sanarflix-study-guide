import { useCallback, useRef } from 'react';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import type { FiltroSemestre, ModoGrafico } from '@/features/gestor/api/types';

/**
 * Telemetria do Portal do Gestor v2 — os 7 eventos da spec §10.
 *
 * Encapsula o tracker que o projeto já usa (`useAnalyticsTracker`, que grava em
 * `public.analytics_events` com dedupe, rate limit e retry). Este módulo é a
 * ÚNICA porta de entrada de telemetria do portal: nenhuma rota/componente
 * chama `trackEvent` direto — assim a garantia de "sem dado de aluno" (spec
 * §7.7) fica concentrada num só lugar, e o teste estático de
 * `seguranca-lgpd.test.tsx` (que varre toda chamada a `trackEvent`/
 * `useAnalyticsTracker` em busca de propriedade identificável) só precisa
 * inspecionar este arquivo.
 *
 * O tracker anexa automaticamente `user_id`/`ies_id` do usuário LOGADO (a
 * gestora), nunca de aluno, e `semestre` do próprio usuário — nada disso é
 * dado de aluno.
 */

export type EventoGestor =
  | 'gestor_tela_vista'
  | 'gestor_filtro_alterado'
  | 'gestor_modo_grafico_alterado'
  | 'gestor_tempo_ate_primeiro_insight'
  | 'gestor_drawer_aberto'
  | 'gestor_export_solicitado'
  | 'gestor_erro_bloco';

/** Chaves que nunca podem entrar num evento, mesmo por acidente de refactor. */
export const CHAVES_PROIBIDAS = [
  'nome',
  'nome_completo',
  'aluno_nome',
  'nomeAluno',
  'alunoNome',
  'email',
  'e_mail',
  'matricula',
  'cpf',
  'telefone',
  'ies_nome',
  'iesNome',
  'enunciado',
  'proficiencia',
  'aluno_id',
  'alunoId',
] as const;

const PARECE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PARECE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PARECE_NOME = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/;

/**
 * Remove chaves proibidas e valores com formato de e-mail/CPF/nome completo.
 * Última linha de defesa antes de qualquer evento sair — ver `CHAVES_PROIBIDAS`
 * para a lista de chaves e as três expressões acima para o formato de valor.
 */
export function sanitizarProps(props: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(props)) {
    if ((CHAVES_PROIBIDAS as readonly string[]).includes(chave)) continue;
    if (typeof valor === 'string' && (PARECE_EMAIL.test(valor) || PARECE_CPF.test(valor) || PARECE_NOME.test(valor))) {
      continue;
    }
    saida[chave] = valor;
  }
  return saida;
}

type Categoria = 'navigation' | 'interaction' | 'error' | 'performance';

export interface TelemetriaGestor {
  /** `useEffect` de mount de cada rota (spec §10, "Adoção por tela"). Reinicia o relógio do primeiro insight. */
  telaVista(tela: 'inicio' | 'visao_geral' | 'detalhamento', semestre: FiltroSemestre): void;
  /** Troca de recorte (semestre/simulados/IES/área) — "o filtro está sendo usado?". */
  filtroAlterado(tipo: 'semestre' | 'simulados' | 'ies' | 'area', valor: string): void;
  /** Troca de modo do gráfico protagonista (Geral/Área/Aluno). */
  modoGraficoAlterado(modo: ModoGrafico): void;
  /** Emite o tempo (ms) até o primeiro insight — chamada interna de `marcarPrimeiroInsight`. */
  tempoAtePrimeiroInsight(ms: number): void;
  /** Abertura de um drawer de investigação (aluno/temas/questão). */
  drawerAberto(tipo: 'aluno' | 'temas' | 'questao'): void;
  /** Clique em "Exportar recorte", antes de qualquer geração de arquivo. */
  exportSolicitado(escopo: 'visao_geral' | 'detalhamento' | 'alunos' | 'questoes'): void;
  /** Bloco caiu em estado de erro (query ou render) — `codigo` identifica a causa, nunca dado de aluno. */
  erroBloco(bloco: string, codigo: string): void;
  /**
   * Marca "chegou a um insight" (primeira expansão da cascata de diagnóstico
   * OU primeira abertura de um drawer) e dispara `tempoAtePrimeiroInsight`
   * UMA vez por sessão de tela — o `ref` interno garante isso; chamadas
   * seguintes, na mesma visita à tela, são no-op até a próxima `telaVista`.
   */
  marcarPrimeiroInsight(): void;
}

/**
 * Task 60 só pode editar `telemetria.ts`, as 3 rotas e `AcoesRecorte.tsx`
 * (ver instrução da task). Onde o gatilho certo de um dos 7 eventos mora fora
 * dessa lista, o evento fica registrado aqui em vez de instrumentado pela
 * metade (uma tentativa anterior instrumentou só parte de uma rota e foi
 * revertida de propósito — instrumentação pela metade é pior que nenhuma).
 */
export interface NaoCorrigido {
  arquivo: string;
  evento: EventoGestor;
  /** Qual variante do evento (ex.: `tipo`/gatilho específico) ficou de fora — quando o evento tem mais de um caminho. */
  detalhe: string;
  motivo: string;
}

export const NAO_CORRIGIDOS: readonly NaoCorrigido[] = [
  {
    arquivo: 'src/features/gestor/components/GraficoProtagonista.tsx',
    evento: 'gestor_modo_grafico_alterado',
    detalhe: 'todo o evento',
    motivo:
      'O toggle Geral/Área/Aluno é `useState` interno a este componente — `VisaoGeral.tsx` só passa a prop `visao`, sem callback de troca de modo. Sem editar este arquivo (fora da lista permitida) não há como observar a troca por fora.',
  },
  {
    arquivo: 'src/features/gestor/components/CascataDiagnostico.tsx',
    evento: 'gestor_tempo_ate_primeiro_insight',
    detalhe: 'gatilho "primeira expansão da cascata de diagnóstico" (o outro gatilho, abertura de drawer, foi instrumentado)',
    motivo:
      'Qual nó da cascata está expandido é estado interno deste componente; a única prop de saída é `onAbrirTemas` (que já aciona `marcarPrimeiroInsight` via abertura do DrawerTemas, instrumentado em VisaoGeral.tsx). Expor a expansão em si exigiria editar este arquivo, fora da lista permitida.',
  },
  {
    arquivo: 'src/features/gestor/shell/SidebarIes.tsx',
    evento: 'gestor_filtro_alterado',
    detalhe: "tipo: 'ies'",
    motivo:
      "SidebarIes.tsx semeia `?ies` automaticamente (`useEffect` + `setIesId(contexto.iesAtual.id)`) sempre que a URL não tem uma seleção válida — o que acontece em todo primeiro acesso, não só quando a pessoa troca de IES no dropdown. Observar `filtros.iesId` a partir das rotas (mesma técnica usada para 'semestre') não distingue as duas origens e emitiria um falso 'filtro alterado' em toda visita inicial. Só dá para diferenciar corretamente dentro do onValueChange do <Select>, em SidebarIes.tsx — fora da lista permitida.",
  },
  {
    arquivo: 'src/features/gestor/api/queries.ts (ResultadoGestor/useEnvelope) e src/features/gestor/components/BlocoErrorBoundary.tsx',
    evento: 'gestor_erro_bloco',
    detalhe: 'todo o evento (caminho de erro de query e de render)',
    motivo:
      '`codigo` deveria ser o código do erro da RPC, mas `ResultadoGestor<T>` (api/queries.ts) só expõe `isError: boolean` — `chamarRpcGestor` descarta `error.message` ao lançar. Sem editar api/queries.ts (fora da lista) não há `codigo` real para o caminho de erro de QUERY. Para o caminho de erro de RENDER, o próprio `BlocoErrorBoundary.tsx` já comenta que seu `onError` é o ponto pensado para este evento, mas o arquivo está fora da lista permitida. Preferi não emitir com um `codigo` inventado (ex.: sempre "erro_desconhecido") a inventar uma taxonomia que não está na spec.',
  },
] as const;

/** Tipo exato de `trackEvent`, extraído do próprio hook — sem duplicar `TrackEventParams` (não exportado por `useAnalyticsTracker.ts`). */
type TrackEvent = ReturnType<typeof useAnalyticsTracker>['trackEvent'];
const trackEventNoop: TrackEvent = async () => undefined;

/**
 * `useAnalyticsTracker` chama `useAuth()`, que lança
 * ("useAuth must be used within an AuthProvider", `src/contexts/AuthContext.tsx:649-655`)
 * quando não há um `<AuthProvider>` real na árvore. Em produção ele sempre
 * existe (montado na raiz do app); mas testes de unidade de OUTRA task
 * renderizam as rotas do gestor isoladas — confirmado empiricamente:
 * - `VisaoGeral.test.tsx`/`Detalhamento.test.tsx`/`seguranca-lgpd.test.tsx`
 *   não mockam `@/contexts/AuthContext` nem `@/hooks/useAnalyticsTracker` —
 *   sem esta guarda, `useAuth()` lança de verdade e derruba as 3 suítes.
 * - `Inicio.test.tsx` mocka `@/contexts/AuthContext` só com `useAuth` (sem o
 *   objeto `AuthContext`) — por isso a guarda não pode importar `AuthContext`
 *   e checar `useContext` direto (primeira versão disto quebrou essa suíte
 *   com "No AuthContext export is defined on the mock"). Um try/catch em
 *   volta da chamada real cobre os dois casos sem depender de qual
 *   exportação está mockada: só absorve o erro ESPECÍFICO de `useAuth`
 *   (`instanceof Error` com a mensagem conhecida) — qualquer outra exceção
 *   sobe normalmente, sem mascarar um bug real.
 *
 * `useAnalyticsTracker()` continua sendo chamado incondicionalmente (nenhum
 * `if`/ternário em volta do hook) — o try/catch só absorve o que ele lança
 * *depois* de já ter sido chamado, então a contagem/ordem de hooks nunca
 * varia entre renders da mesma instância (o `eslint-plugin-react-hooks`
 * confirma isso: nenhuma violação de `rules-of-hooks` neste arquivo).
 */
function useAnalyticsTrackerSeguro(): { trackEvent: TrackEvent } {
  try {
    return useAnalyticsTracker();
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes('AuthProvider')) {
      return { trackEvent: trackEventNoop };
    }
    throw erro;
  }
}

export function useTelemetriaGestor(): TelemetriaGestor {
  const { trackEvent } = useAnalyticsTrackerSeguro();
  const inicio = useRef<number>(Date.now());
  const insightJaMedido = useRef(false);

  const emitir = useCallback(
    (eventName: EventoGestor, category: Categoria, data: Record<string, unknown>) => {
      trackEvent({ eventName, category, data: sanitizarProps(data) as never });
    },
    [trackEvent],
  );

  const telaVista = useCallback(
    (tela: 'inicio' | 'visao_geral' | 'detalhamento', semestre: FiltroSemestre) => {
      inicio.current = Date.now();
      insightJaMedido.current = false;
      emitir('gestor_tela_vista', 'navigation', { tela, semestre });
    },
    [emitir],
  );

  const tempoAtePrimeiroInsight = useCallback(
    (ms: number) => emitir('gestor_tempo_ate_primeiro_insight', 'performance', { ms }),
    [emitir],
  );

  const marcarPrimeiroInsight = useCallback(() => {
    if (insightJaMedido.current) return;
    insightJaMedido.current = true;
    tempoAtePrimeiroInsight(Date.now() - inicio.current);
  }, [tempoAtePrimeiroInsight]);

  const filtroAlterado = useCallback(
    (tipo: 'semestre' | 'simulados' | 'ies' | 'area', valor: string) =>
      emitir('gestor_filtro_alterado', 'interaction', { tipo, valor }),
    [emitir],
  );

  const modoGraficoAlterado = useCallback(
    (modo: ModoGrafico) => emitir('gestor_modo_grafico_alterado', 'interaction', { modo }),
    [emitir],
  );

  const drawerAberto = useCallback(
    (tipo: 'aluno' | 'temas' | 'questao') => emitir('gestor_drawer_aberto', 'interaction', { tipo }),
    [emitir],
  );

  const exportSolicitado = useCallback(
    (escopo: 'visao_geral' | 'detalhamento' | 'alunos' | 'questoes') =>
      emitir('gestor_export_solicitado', 'interaction', { escopo }),
    [emitir],
  );

  const erroBloco = useCallback(
    (bloco: string, codigo: string) => emitir('gestor_erro_bloco', 'error', { bloco, codigo }),
    [emitir],
  );

  return {
    telaVista,
    filtroAlterado,
    modoGraficoAlterado,
    tempoAtePrimeiroInsight,
    drawerAberto,
    exportSolicitado,
    erroBloco,
    marcarPrimeiroInsight,
  };
}
