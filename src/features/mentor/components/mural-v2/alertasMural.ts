/**
 * Atalhos "Adicionar por alerta" do composer (docs/02 § Tela 4), com as mesmas regras do Início
 * (docs/05 § Alertas): o servidor já marca segmento de atividade (mentor_turma) e regrediu/estagnado/fezUltimo
 * (mentor_desempenho_turma). Sem simulado encerrado (V0), só os alertas de engajamento.
 */
import type { AlunoTurmaAcademy, DesempenhoTurmaB2c } from '@/features/mentor/api/types';

export interface GrupoAlerta {
  chave: 'sumiram' | 'esfriando' | 'regrediram' | 'estagnados' | 'nao_fizeram';
  rotulo: string;
  /** E-mails do Academy; a tela converte para `alunoId` da fonte. */
  emails: string[];
}

export function gruposDeAlerta(turma: AlunoTurmaAcademy[] | undefined, desempenho: DesempenhoTurmaB2c | undefined): GrupoAlerta[] {
  const lista = turma ?? [];
  const sumiram = lista.filter((a) => a.segmento === 'sumido').map((a) => a.email);
  const simuladoId = desempenho?.participacaoUltimo.simuladoId ?? null;
  const grupos: GrupoAlerta[] = [{ chave: 'sumiram', rotulo: 'Sumiram', emails: sumiram }];
  if (!simuladoId) {
    grupos.push({ chave: 'esfriando', rotulo: 'Esfriando', emails: lista.filter((a) => a.segmento === 'esfriando').map((a) => a.email) });
  } else {
    const alunos = desempenho?.alunos ?? [];
    const ordem = desempenho?.simulados.find((s) => s.id === simuladoId)?.ordem ?? null;
    grupos.push(
      { chave: 'regrediram', rotulo: 'Regrediram', emails: alunos.filter((a) => a.regrediu).map((a) => a.email) },
      { chave: 'estagnados', rotulo: 'Estagnados', emails: alunos.filter((a) => a.estagnado).map((a) => a.email) },
      {
        chave: 'nao_fizeram',
        rotulo: ordem == null ? 'Não fizeram o último simulado' : `Não fizeram o ${ordem}º simulado`,
        emails: alunos.filter((a) => a.fezUltimo === false).map((a) => a.email),
      },
    );
  }
  return grupos.filter((g) => g.emails.length > 0);
}
