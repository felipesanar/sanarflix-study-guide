# Relatórios do Simulado 4 — grupo UNIATENAS

Gerar os relatórios institucionais (PDF + XLSX) usando a mesma engine que o botão "Exportar dados" do Portal do Gestor usa, sem alterar código de produto. Eu rodo a engine fora do navegador e entrego os arquivos aqui no chat.

Simulado: **UNIATENAS - 4º, 5º e 6º Ano | Simulado 4** (aplicado em 31/07/2026), com TRI processado nas 6 IES do grupo: PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO e VALENÇA.

## Como funciona hoje (contexto)

O relatório é montado no navegador, por IES, a partir do recorte ativo (instituição + semestre + simulados). Não existe relatório consolidado de grupo — cada IES gera o seu. Os 4 blocos padrão são: indicadores do recorte, evolução institucional, acerto por grande área e distribuição de alunos.

## Um detalhe importante sobre "4º, 5º e 6º ano"

O filtro do portal trabalha com **período do aluno** (1º…12º), não com "ano". O recorte "6º ano" existe nativamente; 4º e 5º ano correspondem a pares de períodos. Pelos dados reais deste simulado, os alunos estão assim distribuídos:

```text
4º ano  → 7º período (todas as 6 IES) e 8º período (SORRISO 1, VALENÇA 2)
5º ano  → 9º período (todas) e 10º período (PARACATU, PASSOS, SETE LAGOAS, SORRISO, VALENÇA)
6º ano  → 11º período (PARACATU, PASSOS, SETE LAGOAS, VALENÇA) — recorte "6º ano" do portal
          PORTO SEGURO e SORRISO não têm aluno de 6º ano neste simulado
```

Vou gerar um arquivo por **período com dados** (nomeado com o ano correspondente, ex.: "4º ano — 7º período") e, para o 6º ano, usar o recorte nativo "6º ano" do portal. Períodos com amostra mínima (1 ou 2 alunos) entram com o aviso de amostra baixa que a engine já imprime. Nada é agregado por mim: cada arquivo é exatamente o que o portal mostraria naquele recorte.

## Entrega

- Um PDF e um XLSX por IES × recorte, com os 4 blocos padrão e o recorte fechado apenas no Simulado 4.
- Estimativa: ~24 a 28 pares de arquivos (só os recortes com dados), entregues em `/mnt/documents/relatorios-uniatenas-simulado-4/`, com nomes tipo `PARACATU_4ano-7periodo_Simulado-4.pdf`.
- Se preferir, consolido tudo num único ZIP por IES — diga e eu ajusto.

## Detalhes técnicos

- Dados: as próprias RPCs do portal (`get_gestor_visao_geral` com `p_simulados` fixo no Simulado 4), executadas com o contexto de um gestor real do grupo via edge function descartável `tmp-run-sql` (mesmo fluxo já usado neste projeto), para que os guards de permissão e o escopo por IES continuem valendo. Zero reimplementação de regra de negócio.
- Geração: script Node em `/tmp` que importa `src/features/gestor/lib/exportarRecorte.ts` (`relatorioPdf.ts` para o PDF, `xlsx` para a planilha) e grava o arquivo em disco em vez de disparar download. Nenhum arquivo de `src/` é alterado.
- QA obrigatório: cada PDF é convertido em imagem e inspecionado página a página (capa, seções, tabelas, rodapé paginado) antes da entrega; conferência de que ausência de dado sai como travessão, nunca zero.
- A edge function temporária é removida ao final.
