/**
 * Contrato de `get_gestor_aluno_desempenho_por_area` (RPC nova em produção,
 * 09/08) — granularidade grande área → especialidade → tema para UM aluno.
 *
 * Isolado de `api/types.ts` DE PROPÓSITO: aquele arquivo está em edição
 * paralela por outra tarefa no mesmo dia, e um tipo novo ali entraria em
 * conflito de merge com o que a outra tarefa está escrevendo. Mesma forma de
 * `AlunoSimuladoEntry` (uma entrada POR SIMULADO, nunca fundida entre
 * simulados — regra de agregação honesta) — só que aqui a entrada carrega a
 * lista de linhas de área/especialidade/tema em vez dos campos agregados do
 * aluno.
 */

/**
 * Uma linha de TEMA — a folha da hierarquia. `grandeArea`/`especialidade` são
 * as chaves de agrupamento do drill-down (repetidas em cada linha da mesma
 * especialidade, exatamente como a RPC devolve); `tema` é o nível mais fundo
 * que este contrato tem. Nunca existe um `acertoPct` "de grande área" ou "de
 * especialidade" na resposta — esses níveis são só agrupamento visual no
 * front, sem número calculado ali (ver `agruparPorArea` em `DrawerAluno.tsx`).
 */
export interface AreaDesempenhoAluno {
  grandeArea: string;
  especialidade: string;
  tema: string;
  questoesRespondidas: number;
  questoesTotal: number;
  acertoPct: number;
  critica: boolean;
}

/** Uma entrada por simulado — mesmo espírito de `AlunoSimuladoEntry`. */
export interface DesempenhoPorAreaSimulado {
  simuladoId: string;
  nome: string;
  areas: AreaDesempenhoAluno[];
}
