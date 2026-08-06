import * as React from 'react';

/**
 * Devolve o foco ao elemento que abriu o drawer, quando ele fecha.
 *
 * **Por que isto existe.** Os dois drawers do portal renderizam `<Sheet open>`
 * — com `open` cravado em `true`. Quem controla a abertura é o componente pai,
 * que simplesmente deixa de renderizar o drawer. Como o Radix nunca observa a
 * transição aberto → fechado, o `FocusScope` dele não executa a restauração e
 * o foco cai em `<body>`: quem navega por teclado perde o lugar na tela e
 * precisa tabular desde o topo da página. Achado da Task 58 (§11), confirmado
 * como defeito de produto e não como artefato de teste.
 *
 * **Por que a captura acontece na renderização, não num efeito.** Efeitos de
 * componente filho rodam antes dos do pai. Quando um efeito daqui disparasse,
 * o `SheetContent` já teria movido o foco para dentro do diálogo, e nós
 * guardaríamos um elemento de dentro do próprio drawer em vez do disparador.
 *
 * **O conserto de raiz**, que não é este: os drawers passarem `open={aberto}`
 * de verdade e deixarem o Radix desmontar sozinho. Isso muda o contrato dos
 * dois componentes e dos pais que os montam — escopo próprio, não desta
 * correção de acessibilidade.
 */
export function useDevolverFocoAoFechar(aberto: boolean): void {
  const disparador = React.useRef<HTMLElement | null>(null);

  if (aberto && disparador.current === null) {
    disparador.current = document.activeElement as HTMLElement | null;
  }

  React.useEffect(() => {
    if (!aberto) return undefined;
    // A limpeza roda tanto quando `aberto` vira false quanto no desmonte —
    // e é o desmonte que acontece de fato hoje, porque o pai para de
    // renderizar o drawer.
    return () => {
      const alvo = disparador.current;
      disparador.current = null;
      // `document.contains` guarda contra devolver foco a um nó que saiu da
      // árvore junto com o drawer (ex.: a linha da tabela foi repaginada).
      if (alvo && alvo !== document.body && document.contains(alvo)) alvo.focus();
    };
  }, [aberto]);
}
