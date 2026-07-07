/**
 * Copiloto condutor do console de Gestão — motor de insights determinístico
 * (sem LLM) que lê o `InstitutionalViewModel` do recorte ativo e propõe os
 * próximos passos. Ver `insightEngine.ts` para as regras por tela e
 * `CopilotoStrip.tsx` para a faixa visual.
 */
export { deriveInsights } from './insightEngine';
export type { CopilotoInsight, CopilotoAction, CopilotoTone } from './insightEngine';
export { CopilotoStrip } from './CopilotoStrip';
export type { CopilotoStripProps } from './CopilotoStrip';
