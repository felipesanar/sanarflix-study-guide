import * as React from 'react';

/**
 * Peças partilhadas do cartão de instituição da sidebar (spec §3).
 *
 * Extraídas de `SidebarIes.tsx` porque agora são usadas em TRÊS lugares com o
 * mesmo desenho: o gatilho do seletor, cada item do painel de troca e o
 * skeleton. Antes viviam locais ao componente e o painel teria de duplicá-las.
 */

/**
 * Altura do cartão de IES: 8px de padding + o tile de 32px + 8px. É a MESMA
 * nos três desfechos (gatilho, rótulo estático e skeleton) — sem isso a
 * sidebar encolhia quando `get_gestor_contexto` respondia, justamente no papel
 * majoritário (`gestor`), que é o do rótulo estático.
 */
export const ALTURA_CARTAO = 48;

/** Caixa do cartão, partilhada pelas ramificações. */
export const CARTAO: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  minHeight: ALTURA_CARTAO,
  borderRadius: 'var(--gp-radius-md)',
};

/**
 * Shimmer do skeleton do cartão — os MESMOS tokens `--gp-skeleton`/
 * `--gp-skeleton-brilho` (calibrados nos dois temas em `gestor-theme.css`) e o
 * MESMO gradiente que `GestorSkeleton.tsx` usa. Duplicado em vez de
 * reaproveitado porque `GestorSkeleton` embrulha o resultado num `role="status"`
 * próprio, e aqui só pode haver UM "Carregando instituição" por cartão.
 */
export const SHIMMER: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--gp-skeleton) 25%, var(--gp-skeleton-brilho) 50%, var(--gp-skeleton) 75%)',
  backgroundSize: '200% 100%',
};

/** Tipografia do nome da IES dentro do cartão. */
export const NOME_IES: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  lineHeight: '16px',
  color: 'var(--gp-text-1)',
};

/** Linha de contexto sob o nome (escopo de acesso / contrato). */
export const CONTEXTO_IES: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 500,
  lineHeight: '13px',
  letterSpacing: '0.02em',
  color: 'var(--gp-text-3)',
};

/** Partículas que não entram na sigla — "Fac. de Medicina" vira "FM", não "FD". */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para']);

/** Sigla de até 2 letras da IES, para o tile do cartão. */
export const iniciaisDaIes = (nome: string): string =>
  nome
    .split(/\s+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .slice(0, 2)
    .map((parte) => (parte.match(/\p{L}/u)?.[0] ?? '').toUpperCase())
    .join('');

/**
 * Normalização para a busca: minúsculas e sem acento, para "unicamp" achar
 * "UNICAMP" e "sao" achar "São".
 */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Tile com a sigla da IES. No claro é a tinta neutra mais escura; no escuro é
 * a marca — é o que a referência faz nos dois temas, e é também o que mantém a
 * sigla legível quando a superfície inverte.
 */
export const TileIes: React.FC<{ nome: string; tamanho?: number }> = ({ nome, tamanho = 32 }) => (
  <span
    aria-hidden="true"
    className="flex shrink-0 items-center justify-center bg-[color:var(--gp-text-1)] dark:bg-[color:var(--gp-brand)]"
    style={{
      width: tamanho,
      height: tamanho,
      borderRadius: 'var(--gp-radius-sm)',
      fontSize: tamanho <= 26 ? 9.5 : 11,
      fontWeight: 700,
      letterSpacing: '0.01em',
      /**
       * `lineHeight: 1` é o que centra a sigla de verdade: `align-items:
       * center` centra a CAIXA DE LINHA, não o desenho da letra, e o
       * `line-height: normal` da Inter tem folga assimétrica em torno de uma
       * palavra só de maiúsculas.
       */
      lineHeight: 1,
      color: 'var(--gp-text-inverse)',
    }}
  >
    {iniciaisDaIes(nome)}
  </span>
);
