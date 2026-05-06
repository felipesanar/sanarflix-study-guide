## Plano: Multiseleção de Semestres no SanarClass Admin

### O que muda

No modal "Adicionar nova aula", o campo de semestre passa de seleção única para multiseleção com checkboxes. Ao salvar, o sistema cria uma row na tabela `sanarclass_lessons` para cada semestre selecionado (mesmo título, professor, disciplina, arquivo, IES — apenas o semestre difere).

### Implementação

**Arquivo:** `src/components/admin/SanarClassTab.tsx`

1. **Alterar `LessonFormData.semestre`** de `string` para `string[]` (array de semestres selecionados).

2. **Substituir o `<Select>` de semestre no modal de adição** por um componente de checkboxes ou um dropdown multi-select que permite marcar vários semestres (1º ao 12º). Exibir os semestres selecionados como chips/tags no trigger.

3. **Alterar `handleAddLesson`**: após o upload do arquivo, fazer um `.insert()` com um array de objetos — um para cada semestre selecionado. Isso usa uma única chamada ao Supabase e é atômico.

4. **Manter o modal de edição com seleção única** (editar uma aula já existente altera apenas aquela row específica).

### Detalhes técnicos

- O insert múltiplo fica:
```ts
const rows = formData.semestre.map(sem => ({
  titulo: formData.titulo,
  professor: formData.professor,
  disciplina: formData.disciplina,
  semestre: parseInt(sem),
  formato: formData.formato,
  arquivo_url: arquivoUrl,
  preview_url: arquivoUrl,
  ies_id: formData.ies_id,
}));
await supabase.from('sanarclass_lessons').insert(rows);
```

- Não requer migração de banco — a tabela já suporta múltiplas rows com semestres diferentes.
- O toast de sucesso indicará quantos semestres foram cadastrados.
