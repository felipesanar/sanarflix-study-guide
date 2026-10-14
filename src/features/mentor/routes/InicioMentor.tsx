import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { fetchMentorContexto } from '@/services/mentor/contexto';
import { fetchTurma } from '@/services/mentor/turma';
import { fetchDesempenhoTurma } from '@/services/mentor/desempenho';
import { listarSessoes } from '@/services/mentor/sessoes';
import { listarIntervencoes } from '@/services/mentor/intervencoes';
import { ehLinkHttp } from '@/features/mentor/lib/linkSeguro';
import { EstadoErro } from '@/features/mentor/components/turma/EstadoErro';
import { contarAlertas, numeroUltimoSimulado, temDadosSimulado, formatPct } from '@/features/mentor/components/turma/simulados';
import { formatDiaMesHora, formatUltimoAcesso, nomeOuEmail, plural } from '@/features/mentor/components/turma/util';

const MAX_NOMES_SUMIDOS = 5;
const MAX_CARDS_A_FAZER = 3;

const CardBase: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="space-y-3 rounded-xl border bg-card p-4">
    <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
    {children}
  </section>
);

const Carregando: React.FC = () => <p className="text-sm text-muted-foreground">Carregando…</p>;

const CardSumiram: React.FC = () => {
  const turma = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  const sumidos = React.useMemo(
    () =>
      (turma.data ?? [])
        .filter((a) => a.segmento === 'sumido')
        .sort((a, b) => (b.dias_sem_atividade ?? 0) - (a.dias_sem_atividade ?? 0)),
    [turma.data],
  );

  return (
    <CardBase titulo="Sumiram (10+ dias sem acesso)">
      {turma.isLoading && <Carregando />}
      {turma.isError && (
        <EstadoErro mensagem="Não foi possível carregar a turma." onRetry={() => void turma.refetch()} />
      )}
      {turma.data && sumidos.length === 0 && (
        <p className="text-sm text-muted-foreground">Ninguém sumiu. Sua turma está em dia.</p>
      )}
      {turma.data && sumidos.length > 0 && (
        <>
          <p className="text-3xl font-semibold">{sumidos.length}</p>
          <ul className="space-y-1 text-sm">
            {sumidos.slice(0, MAX_NOMES_SUMIDOS).map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-2">
                <Link to={`/mentor/turma?aluno=${encodeURIComponent(a.email)}`} className="hover:underline">
                  {nomeOuEmail(a)}
                </Link>
                <span className="text-muted-foreground">{formatUltimoAcesso(a.dias_sem_atividade)}</span>
              </li>
            ))}
          </ul>
          {sumidos.length > MAX_NOMES_SUMIDOS && (
            <p className="text-xs text-muted-foreground">e mais {sumidos.length - MAX_NOMES_SUMIDOS}</p>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/mentor/turma?filtro=sumido">Ver na turma</Link>
          </Button>
        </>
      )}
    </CardBase>
  );
};

const CardProximaSessao: React.FC = () => {
  const sessoes = useQuery({
    queryKey: ['mentor', 'sessoes', 'proximas'],
    queryFn: () => listarSessoes('proximas'),
  });
  const proxima = sessoes.data?.find((s) => s.tipo === 'coletiva' && s.status === 'agendada');

  return (
    <CardBase titulo="Próxima sessão coletiva">
      {sessoes.isLoading && <Carregando />}
      {sessoes.isError && (
        <EstadoErro mensagem="Não foi possível carregar as sessões." onRetry={() => void sessoes.refetch()} />
      )}
      {sessoes.data && !proxima && (
        <>
          <p className="text-sm text-muted-foreground">Nenhuma sessão coletiva agendada.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/mentor/sessoes">Agendar sessão</Link>
          </Button>
        </>
      )}
      {proxima && (
        <>
          <div>
            <p className="font-medium">{proxima.titulo}</p>
            <p className="text-sm text-muted-foreground">{formatDiaMesHora(proxima.inicio)}</p>
          </div>
          {ehLinkHttp(proxima.meet_link) ? (
            <Button asChild variant="outline" size="sm">
              <a href={proxima.meet_link?.trim()} target="_blank" rel="noopener noreferrer">
                Abrir o Meet
              </a>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/mentor/sessoes">Adicionar link do Meet</Link>
            </Button>
          )}
        </>
      )}
    </CardBase>
  );
};

const CardAFazer: React.FC = () => {
  const lista = useQuery({
    queryKey: ['mentor', 'intervencoes', 'inicio'],
    queryFn: () => listarIntervencoes(null, null),
  });
  const cards = (lista.data?.cards ?? []).filter((c) => c.status === 'a_fazer').slice(0, MAX_CARDS_A_FAZER);

  return (
    <CardBase titulo="A fazer">
      {lista.isLoading && <Carregando />}
      {lista.isError && (
        <EstadoErro mensagem="Não foi possível carregar as intervenções." onRetry={() => void lista.refetch()} />
      )}
      {lista.data && cards.length === 0 && (
        <p className="text-sm text-muted-foreground">Nada a fazer por enquanto.</p>
      )}
      {cards.length > 0 && (
        <ul className="space-y-2 text-sm">
          {cards.map((c) => (
            <li key={c.id} className="rounded-md border px-3 py-2">
              <p className="font-medium">{c.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {c.alvo === 'turma' ? 'Turma toda' : plural(c.alunos.length, 'aluno', 'alunos')}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" size="sm">
        <Link to="/mentor/intervencoes">Ver todas as intervenções</Link>
      </Button>
    </CardBase>
  );
};

const CardAlerta: React.FC<{
  titulo: string;
  descricao: string;
  qtd: number;
  vazio: string;
  link: string;
  rotuloLink: string;
}> = ({ titulo, descricao, qtd, vazio, link, rotuloLink }) => (
  <CardBase titulo={titulo}>
    <p className="text-3xl font-semibold">{qtd}</p>
    <p className="text-xs text-muted-foreground">{descricao}</p>
    {qtd === 0 ? (
      <p className="text-sm text-muted-foreground">{vazio}</p>
    ) : (
      <Button asChild variant="outline" size="sm">
        <Link to={link}>{rotuloLink}</Link>
      </Button>
    )}
  </CardBase>
);

/** Faixa do último simulado + alertas. Só aparece quando a turma tem nota de simulado. */
const AlertasSimulados: React.FC<{ habilitado: boolean }> = ({ habilitado }) => {
  const desempenho = useQuery({
    queryKey: ['mentor', 'desempenho', 'todos'],
    queryFn: () => fetchDesempenhoTurma(),
    enabled: habilitado,
  });
  const dados = desempenho.data;
  if (!dados || !temDadosSimulado(dados)) return null;

  const alertas = contarAlertas(dados.alunos);
  const { simulado_id, fizeram, total } = dados.participacao_ultimo;
  const numero = numeroUltimoSimulado(dados);
  const pct = total > 0 ? (fizeram / total) * 100 : 0;

  return (
    <div className="space-y-4">
      {simulado_id && (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="font-medium">{numero !== null ? `Simulado ${numero}` : 'Último simulado'}</span>
          {' · '}fizeram {fizeram} de {total} ({formatPct(pct)})
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <CardAlerta
          titulo="Regrediram"
          descricao="Queda de 5 p.p. ou mais entre os 2 últimos simulados"
          qtd={alertas.regrediu}
          vazio="Ninguém regrediu."
          link="/mentor/turma?filtro=regrediu"
          rotuloLink={`Ver os ${alertas.regrediu} que regrediram`}
        />
        <CardAlerta
          titulo="Estagnados"
          descricao="Menos de 2 p.p. de variação nos 3 últimos simulados"
          qtd={alertas.estagnado}
          vazio="Ninguém estagnado."
          link="/mentor/turma?filtro=estagnado"
          rotuloLink={`Ver os ${alertas.estagnado} estagnados`}
        />
        <CardAlerta
          titulo="Não fizeram o último simulado"
          descricao="Simulado encerrado, sem tentativa finalizada"
          qtd={alertas.nao_fez}
          vazio="Todos fizeram."
          link="/mentor/turma?filtro=nao_fez"
          rotuloLink={`Ver os ${alertas.nao_fez} que não fizeram`}
        />
      </div>
    </div>
  );
};

/**
 * Início do mentor (tela 01) — alertas da turma, próxima sessão coletiva e
 * as intervenções a fazer. Regrediram/Estagnados/Não fizeram e a faixa do
 * último simulado só aparecem quando a turma tem nota de simulado.
 */
const InicioMentor: React.FC = () => {
  const contexto = useQuery({ queryKey: ['mentor', 'contexto'], queryFn: fetchMentorContexto });
  const turma = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma, enabled: !!contexto.data?.mentor });
  const qtdSumidos = (turma.data ?? []).filter((a) => a.segmento === 'sumido').length;

  if (contexto.isLoading) return <p className="text-sm text-muted-foreground">Carregando sua turma…</p>;
  if (contexto.isError) {
    return (
      <EstadoErro
        mensagem="Não foi possível carregar sua turma. Tente de novo em instantes."
        onRetry={() => void contexto.refetch()}
      />
    );
  }

  if (!contexto.data?.mentor) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Seu cadastro de mentor ainda não foi concluído</h1>
        <p className="text-muted-foreground">Fale com o time de atendimento para vincular sua turma.</p>
      </div>
    );
  }

  const { mentor, alunos_ativos } = contexto.data;
  const primeiroNome = mentor.nome.split(' ')[0];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {plural(alunos_ativos, 'aluno', 'alunos')} · {mentor.turma_nome}
        </span>
        <h1 className="text-2xl font-semibold">Olá, {primeiroNome}</h1>
        {qtdSumidos > 0 && (
          <p className="text-lg text-foreground">
            {qtdSumidos === 1
              ? '1 aluno sumiu. Comece por ele.'
              : `${qtdSumidos} alunos sumiram. Comece por eles.`}
          </p>
        )}
        {alunos_ativos === 0 && (
          <p className="text-muted-foreground">Sua turma ainda não tem alunos vinculados.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/mentor/intervencoes?novo=1">Nova intervenção</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/mentor/mural?novo=1">Publicar no mural</Link>
          </Button>
        </div>
      </div>

      <AlertasSimulados habilitado={!!contexto.data?.mentor} />

      <div className="grid gap-4 md:grid-cols-3">
        <CardSumiram />
        <CardProximaSessao />
        <CardAFazer />
      </div>
    </div>
  );
};

export default InicioMentor;
