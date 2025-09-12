const CRONOGRAMA_API_URL = 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/cronograma-enamed-proxy';

export interface CronogramaEnamedItem {
  id: string;
  titulo: string;
  descricao: string;
  area_conhecimento: string;
  semana?: string;
  tema?: string;
  subtema?: string;
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
      
      const normalizedItems: CronogramaEnamedItem[] = [];
      
      // Check if data has cronograma property
      if (data && data.cronograma && typeof data.cronograma === 'object') {
        // Iterate through each area (Cirurgia, etc.)
        Object.keys(data.cronograma).forEach(areaKey => {
          const areaData = data.cronograma[areaKey];
          console.log(`Processing area: ${areaKey}`, areaData);
          
          if (Array.isArray(areaData)) {
            // Process each week in the area
            areaData.forEach((weekData: any, weekIndex: number) => {
              if (weekData.temas && Array.isArray(weekData.temas)) {
                // Process each theme in the week
                weekData.temas.forEach((tema: any, temaIndex: number) => {
                  if (tema.subtemas && Array.isArray(tema.subtemas)) {
                    // Process each subtema
                    tema.subtemas.forEach((subtema: any, subtemaIndex: number) => {
                      if (subtema.aulas && Array.isArray(subtema.aulas)) {
                        // Process each aula
                        subtema.aulas.forEach((aula: any, aulaIndex: number) => {
                          const itemId = `${areaKey}-${weekIndex}-${temaIndex}-${subtemaIndex}-${aulaIndex}`;
                          const titulo = aula.nome || subtema.nome || tema.nome || 'Sem título';
                          const descricao = `${tema.nome} - ${subtema.nome || ''}`.trim();
                          
                          normalizedItems.push({
                            id: itemId,
                            titulo,
                            descricao,
                            area_conhecimento: areaKey,
                            semana: weekData.semana || undefined,
                            tema: tema.nome,
                            subtema: subtema.nome,
                            data_aula: weekData.nome || weekData.data || undefined,
                            link_aula: aula.link_aula || undefined,
                            link_gratuito: aula.link_gratuito || undefined
                          });
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
      
      console.log('Normalized items:', normalizedItems);
      return normalizedItems;
      
    } catch (error) {
      console.error('Error fetching cronograma:', error);
      return [];
    }
  }
};