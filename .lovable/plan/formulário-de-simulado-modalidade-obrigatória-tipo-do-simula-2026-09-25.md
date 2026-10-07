# Formulário de simulado: modalidade obrigatória, tipo do simulado e datas de lançamento

## Onde ficam "Início / Término do lançamento de respostas"

Não são campos próprios. São os mesmos dois campos de "Início" e "Término" do simulado online, só com outro nome quando a modalidade é Presencial:

- Início -> `simulados_admin.data_liberacao`
- Término -> `simulados_admin.data_encerramento`

Para que servem hoje (por isso não recomendo remover):
- Definem quando a prova abre e fecha para o aluno na plataforma. O status "aguardando / ativo / encerrado" é calculado a partir deles ao salvar.
- No presencial, é a janela em que o aluno pode ver/lançar as respostas na plataforma. Se ficar vazio, o simulado fica disponível sem prazo.
- O cronograma do gestor usa `data_liberacao` como data do simulado quando falta a data de realização.

Para presencial com respostas importadas pelo admin, esses campos são menos relevantes. Se preferir, num passo seguinte posso escondê-los quando a modalidade for Presencial (os dados ficam no banco, não mexo em nada existente). Não faz parte deste plano, a menos que você peça.

## O que muda

1. **Modalidade obrigatória**
   - Some a opção "Não definida". O botão Salvar só fica habilitado com Online ou Presencial escolhido.
   - Presencial passa a exigir também a Data de realização (o servidor já recusa presencial sem data).
   - Correção junto: hoje, ao **criar** um simulado, modalidade e data de realização nem são gravadas (só na edição). Passam a ser gravadas na criação também.
   - Simulados antigos sem modalidade (28 hoje): ao abrir para editar, o campo aparece vazio e o admin precisa escolher antes de salvar.

2. **Novo campo "Tipo do simulado"** (lista suspensa, obrigatória)
   - Opções: "Simulado ENAMED" (`simulado_enamed`) e "Trilha" (`trilha`).
   - Texto de ajuda: "Só simulados ENAMED aparecem para o gestor."
   - Gravado na criação e na edição. Hoje há 64 ENAMED, 72 trilhas e 3 sem tipo — esses 3 exigem escolha ao editar.

## Detalhes técnicos

- `src/components/admin/simulados/SimuladoConfigDialog.tsx`:
  - `form.tipo: 'simulado_enamed' | 'trilha' | null`, carregado de `simulado.type` no `useEffect` de edição; `Simulado` em `ProvasTab.tsx` passa a ler `type`.
  - Remover `MODALIDADE_NAO_DEFINIDA` do Select (placeholder "Selecione"); `canSave` exige `modalidade`, `tipo` e, se presencial, `dataRealizacao`. Com isso `atualizarAgenda` fica sempre `true`.
  - Insert de criação inclui `modalidade`, `data_realizacao`, `data_agendada_original` (= data_realizacao) e `type`.
- Edição do tipo: nova RPC `admin_set_simulado_type(p_simulado_id uuid, p_type text)` (SECURITY DEFINER, guard `has_role(auth.uid(),'admin')`, valida o valor, grava auditoria `editar_simulado_tipo`; GRANT só a authenticated). Não altero a assinatura de `admin_update_simulado` para evitar sobrecarga de RPC. Migration aditiva.
- `src/services/admin/simulados.ts`: `setSimuladoType()`, chamada após `updateSimulado` quando o tipo mudou.
- Atualizar `src/test/unit/simuladosWrite.test.ts` para o novo payload.
