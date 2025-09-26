import { supabase } from '@/integrations/supabase/client';

export interface IntensivoUSCSItem {
  id: string;
  semana: string;
  dia: string;
  tema_do_dia: string;
  link_aula: string | null;
}

export const intensivoUSCSApi = {
  async getAllContent(): Promise<IntensivoUSCSItem[]> {
    try {
      // Usar a função nativa do Supabase para evitar problemas de tipagem
      const { data, error } = await supabase
        .from('intensivouscs' as any)
        .select('*')
        .order('id');

      if (error) {
        console.error('Erro ao buscar conteúdo do intensivo USCS:', error);
        throw new Error('Falha ao carregar conteúdo do intensivo');
      }

      if (!data) {
        return [];
      }

      return data.map((item: any) => ({
        id: item.id.toString(),
        semana: item.semana,
        dia: item.dia,
        tema_do_dia: item.tema_do_dia,
        link_aula: item.link_aula
      }));
    } catch (error) {
      console.error('Erro na API do intensivo USCS:', error);
      throw error;
    }
  }
};