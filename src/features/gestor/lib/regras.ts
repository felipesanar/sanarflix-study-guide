/**
 * Fonte da verdade das regras de negócio do Portal do Gestor v2.
 *
 * Substitui as cinco réguas incompatíveis mapeadas na spec §4.4 e os dez pontos
 * de `PROFICIENCY_THRESHOLD` duplicados. Nenhum componente reimplementa corte.
 *
 * Referências: spec §4.3 (proficiente >= 60), §4.4 (3 níveis sobre % de acerto),
 * §4.8 (grupos de evolução), §4.10 (null nunca vira zero), §4.11 (tendência).
 */

import type { GrupoEvolucao, NivelDesempenho, Tendencia } from '../api/types';

/**
 * Corte de proficiência do aluno, sobre `resultados_alunos_tri.score_proprio`.
 * `>=`, não `>`: o banco trata `score_proprio < 60` como abaixo do esperado
 * (migration 20260708143105) e `is_proficient_proprio` já materializa isso.
 * O handoff, que diz "> 60", está errado neste ponto (spec §4.3).
 */
export const PROFICIENCIA_MINIMA = 60;

/**
 * Teto exclusivo do nível crítico, sobre **% de acerto** (nunca proficiência).
 *
 * 30 é a decisão vigente da spec §4.4, registrada como RESOLVIDA em 25/07:
 * crítico `<30` / mediano `30–80` / excelente `>=80`, mapeada sobre a régua
 * canônica do projeto sem inventar corte novo.
 *
 * A spec §4.4 mantém um risco aberto: "mediano" absorve 50 pontos e 30% é um
 * piso baixo, então o grupo crítico pode nascer quase sempre vazio. A Task 2 do
 * plano valida a distribuição real e pode subir o corte para 50 — quando isso
 * acontecer, trocar esta constante e os dois casos de fronteira do teste
 * (`29.9`/`30` → `49.9`/`50`) é o custo total da revisão. Nada de arquitetura
 * depende do valor.
 */
export const NIVEL_CRITICO_MAX = 30;

/** Piso inclusivo do nível excelente, sobre % de acerto (spec §4.4). */
export const NIVEL_EXCELENTE_MIN = 80;

/** Proficiência ausente não é "não proficiente por zero" — é ausência (§4.10). */
export function ehProficiente(proficiencia: number | null): boolean {
  return proficiencia !== null && proficiencia >= PROFICIENCIA_MINIMA;
}

/**
 * Classifica **% de acerto** em crítico / mediano / excelente.
 * Vale para grande área, especialidade e tema — os três usam % de acerto e
 * nunca proficiência (spec §4.1, invariantes). `null` devolve `null`: a UI
 * mostra `—`, não "crítico".
 */
export function nivelDesempenho(acertoPct: number | null): NivelDesempenho | null {
  if (acertoPct === null) return null;
  if (acertoPct < NIVEL_CRITICO_MAX) return 'critico';
  if (acertoPct >= NIVEL_EXCELENTE_MIN) return 'excelente';
  return 'mediano';
}

/**
 * Agrupa o aluno pela consistência da proficiência ao longo dos simulados.
 * `null` é buraco na série (não participou) e é descartado antes de classificar.
 * Sem nenhum ponto utilizável, devolve `null` — grupo desconhecido, não "em variação".
 */
export function grupoEvolucao(proficiencias: (number | null)[]): GrupoEvolucao | null {
  const pontos = proficiencias.filter((p): p is number => p !== null);
  if (pontos.length === 0) return null;

  const proficientes = pontos.filter((p) => ehProficiente(p)).length;
  if (proficientes === pontos.length) return 'consistentemente_proficiente';
  if (proficientes === 0) return 'consistentemente_nao_proficiente';
  return 'em_variacao';
}

/**
 * Diferença entre dois pontos comparáveis. Devolve `null` se QUALQUER um dos
 * dois lados for `null` — variação só existe quando os dois pontos existem
 * (spec §4.10 e caso de teste crítico nº8).
 * Arredonda a 1 decimal para não propagar ruído de ponto flutuante para a UI.
 */
export function calcularVariacao(anterior: number | null, atual: number | null): number | null {
  if (anterior === null || atual === null) return null;
  return Math.round((atual - anterior) * 10) / 10;
}

/**
 * Direção da série de proficiência na **janela toda** (spec §4.11) — não é
 * leitura ponto a ponto e não gera tooltip por ponto.
 * Menos de dois pontos utilizáveis => 'estavel' (nada a inferir).
 */
export function tendencia(proficiencias: (number | null)[]): Tendencia {
  const pontos = proficiencias.filter((p): p is number => p !== null);
  if (pontos.length < 2) return 'estavel';

  let subiu = false;
  let desceu = false;

  for (let i = 1; i < pontos.length; i += 1) {
    const delta = pontos[i] - pontos[i - 1];
    if (delta > 0) subiu = true;
    if (delta < 0) desceu = true;
  }

  if (subiu && desceu) return 'alternando';
  if (subiu) return 'subindo';
  if (desceu) return 'descendo';
  return 'estavel';
}
