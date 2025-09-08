const STUDY_GUIDE_API_BASE_URL = 'https://api-guias-de-estudos.onrender.com';

export interface ApiAula {
  id: string;
  nome: string;
  video?: string;
  pdf?: string;
  quiz?: string;
}

export interface ApiSubtema {
  id: string;
  nome: string;
  aulas: ApiAula[];
}

export interface ApiTema {
  id: string;
  nome: string;
  subtemas: ApiSubtema[];
}

export interface ApiMateria {
  id: string;
  nome: string;
  temas: ApiTema[];
}

export interface ApiSemestre {
  id: string;
  numero: number;
  materias: ApiMateria[];
}

export interface ApiIES {
  id: string;
  nome: string;
  semestres: ApiSemestre[];
}

export interface StudyGuideData {
  ies: ApiIES[];
}

export const studyGuideApi = {
  async getStudyGuideData(): Promise<StudyGuideData> {
    try {
      const response = await fetch(`${STUDY_GUIDE_API_BASE_URL}/`);
      if (!response.ok) {
        throw new Error(`Failed to fetch study guide data: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching study guide data:', error);
      throw error;
    }
  },

  async getIESById(iesId: string): Promise<ApiIES | null> {
    try {
      const data = await this.getStudyGuideData();
      return data.ies.find(ies => ies.id === iesId) || null;
    } catch (error) {
      console.error('Error fetching IES by ID:', error);
      throw error;
    }
  },

  async getSemestresByIES(iesId: string): Promise<ApiSemestre[]> {
    try {
      const ies = await this.getIESById(iesId);
      return ies?.semestres || [];
    } catch (error) {
      console.error('Error fetching semestres by IES:', error);
      throw error;
    }
  },

  async getMateriasBySemestre(iesId: string, semestreNumero: number): Promise<ApiMateria[]> {
    try {
      const ies = await this.getIESById(iesId);
      const semestre = ies?.semestres.find(s => s.numero === semestreNumero);
      return semestre?.materias || [];
    } catch (error) {
      console.error('Error fetching materias by semestre:', error);
      throw error;
    }
  }
};