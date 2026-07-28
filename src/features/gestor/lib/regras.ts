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
 * 50, decidido com dado real na Task 2 (Fase 0) e registrado na seção 2.4 de
 * `docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md`.
 *
 * A spec §4.4 propunha `<30` e marcava o risco de o grupo crítico nascer vazio.
 * A medição confirmou o risco: em 87,9% dos recortes (IES × simulado) o corte de
 * 30 não classificaria nenhuma grande área como crítica — 100% se descontado o
 * dado de teste. O critério fixado antes da medição (>70% sem área crítica ⇒
 * sobe para 50) foi acionado.
 *
 * Revisar este valor de novo custa esta linha mais os dois casos de fronteira do
 * teste. Nada de arquitetura depende dele.
 */
export const NIVEL_CRITICO_MAX = 50;

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
