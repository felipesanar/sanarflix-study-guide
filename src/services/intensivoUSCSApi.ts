import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache } from '@/utils/performanceCache';

export interface IntensivoUSCSItem {
  id: string;
  semana: string;
  dia: string;
  tema_do_dia: string;
  link_aula: string | null;
}

export const intensivoUSCSApi = {
  async getAllContent(): Promise<IntensivoUSCSItem[]> {
    return fetchWithCache(
      'intensivo_uscs_all_content',
      async () => {
        try {
          const { data, error } = await supabase
            .from('intensivouscs')
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
      },
      30 * 60 * 1000 // 30 minutos
    );
  }
};