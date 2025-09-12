const CRONOGRAMA_API_URL = 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/cronograma-enamed-proxy';

export interface CronogramaEnamedItem {
  id: string;
  titulo: string;
  descricao: string;
  area_conhecimento: string;
  data_aula?: string;
  link_aula?: string;
  link_gratuito?: string;
}

export const cronogramaEnamedApi = {
  async getAllContent(): Promise<CronogramaEnamedItem[]> {
    try {
      const response = await fetch(CRONOGRAMA_API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch cronograma content');
      }
      
      const data = await response.json();
      console.log('Raw API response:', data);
      
      // Try to extract array from different structures
      let items: any[] = [];
      
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        // Check common array keys
        const possibleKeys = ['data', 'items', 'conteudos', 'aulas', 'cronograma'];
        for (const key of possibleKeys) {
          if (Array.isArray(data[key])) {
            items = data[key];
            break;
          }
        }
      }
      
      console.log('Extracted items:', items);
      
      // Normalize each item
      const normalizedItems: CronogramaEnamedItem[] = items.map((item: any, index: number) => {
        console.log(`Item ${index}:`, item);
        
        return {
          id: item.id || item._id || `item-${index}`,
          titulo: item.titulo || item.title || item.nome || item.name || 'Sem título',
          descricao: item.descricao || item.description || item.resumo || '',
          area_conhecimento: item.area_conhecimento || item.area || item.disciplina || item.specialty || 'Outros',
          data_aula: item.data_aula || item.data || item.date,
          link_aula: item.link_aula || item.url_aula || item.url || item.link,
          link_gratuito: item.link_gratuito || item.link_free || item.free_url
        };
      });
      
      console.log('Normalized items:', normalizedItems);
      return normalizedItems;
      
    } catch (error) {
      console.error('Error fetching cronograma:', error);
      return [];
    }
  }
};