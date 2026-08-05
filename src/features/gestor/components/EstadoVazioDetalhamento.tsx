export function EstadoVazioDetalhamento() {
  return (
    <section
      data-testid="detalhamento-vazio"
      aria-labelledby="detalhamento-vazio-titulo"
      className="rounded-lg border border-dashed border-border p-8 text-center"
    >
      <h2 id="detalhamento-vazio-titulo" className="text-base font-semibold text-foreground">
        Escolha ao menos um simulado
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Os indicadores desta tela são calculados sobre os simulados que você selecionar acima. Não há leitura de todos:
        cada recorte precisa ser explícito.
      </p>
    </section>
  );
}
