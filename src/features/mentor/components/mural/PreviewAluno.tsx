import * as React from 'react';
import { Paperclip } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FormularioMural } from './muralUtils';

interface Props {
  form: FormularioMural;
  anexoNome: string | null;
}

const Cartao: React.FC<{ form: FormularioMural; anexoNome: string | null; paraVoce: boolean }> = ({
  form,
  anexoNome,
  paraVoce,
}) => (
  <article className="space-y-2 rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-full bg-muted px-2 py-0.5">{form.tag.trim() || 'Sem tag'}</span>
      {paraVoce && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Pra você</span>}
    </div>
    <h3 className="font-semibold">{form.titulo.trim() || 'Título da publicação'}</h3>
    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
      {form.mensagem.trim() || 'A mensagem aparece aqui.'}
    </p>
    {form.linkUrl.trim() && (
      <p className="text-sm text-primary underline">{form.linkTitulo.trim() || form.linkUrl.trim()}</p>
    )}
    {anexoNome && (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        {anexoNome}
      </p>
    )}
  </article>
);

/** "Como o aluno vê": Coletivo sempre; "Pra você" só quando o público é Selecionados. */
export const PreviewAluno: React.FC<Props> = ({ form, anexoNome }) => {
  const [aba, setAba] = React.useState('coletivo');
  const temPraVoce = form.publico === 'selecionados';
  const abaAtiva = temPraVoce ? aba : 'coletivo';

  return (
    <section aria-label="Como o aluno vê" className="space-y-3">
      <h2 className="text-sm font-semibold">Como o aluno vê</h2>
      <Tabs value={abaAtiva} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="coletivo">Coletivo</TabsTrigger>
          {temPraVoce && <TabsTrigger value="pra-voce">Pra você</TabsTrigger>}
        </TabsList>
        <TabsContent value="coletivo">
          <Cartao form={form} anexoNome={anexoNome} paraVoce={false} />
        </TabsContent>
        {temPraVoce && (
          <TabsContent value="pra-voce">
            <Cartao form={form} anexoNome={anexoNome} paraVoce />
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
};
