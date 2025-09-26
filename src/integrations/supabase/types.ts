export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      answer_progress_enamed: {
        Row: {
          answer_id: string
          correct: boolean
          email: string
          question_id: string
          simulado: number
        }
        Insert: {
          answer_id?: string
          correct: boolean
          email: string
          question_id: string
          simulado: number
        }
        Update: {
          answer_id?: string
          correct?: boolean
          email?: string
          question_id?: string
          simulado?: number
        }
        Relationships: [
          {
            foreignKeyName: "answer_progress_enamed_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "answer_progress_enamed_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_enamed"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "answer_progress_enamed_simulado_fkey"
            columns: ["simulado"]
            isOneToOne: false
            referencedRelation: "Simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudos: {
        Row: {
          conteudos: Json
          id: string
          id_ies: string
          semestre: number
        }
        Insert: {
          conteudos: Json
          id?: string
          id_ies: string
          semestre: number
        }
        Update: {
          conteudos?: Json
          id?: string
          id_ies?: string
          semestre?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_ies"
            columns: ["id_ies"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
      }
      ies: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id?: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
      }
      intensivouscs: {
        Row: {
          dia: string
          id: number
          link_aula: string | null
          semana: string
          tema_do_dia: string
        }
        Insert: {
          dia: string
          id?: number
          link_aula?: string | null
          semana: string
          tema_do_dia: string
        }
        Update: {
          dia?: string
          id?: number
          link_aula?: string | null
          semana?: string
          tema_do_dia?: string
        }
        Relationships: []
      }
      questions_enamed: {
        Row: {
          Especialidade: string | null
          ID: string
          "NÍVEL DE DIFICULDADE": string | null
          "Subespecialidade / Assunto Principal": string | null
          "Tem Imagem": string | null
          "Tema (Grande Área)": string | null
        }
        Insert: {
          Especialidade?: string | null
          ID: string
          "NÍVEL DE DIFICULDADE"?: string | null
          "Subespecialidade / Assunto Principal"?: string | null
          "Tem Imagem"?: string | null
          "Tema (Grande Área)"?: string | null
        }
        Update: {
          Especialidade?: string | null
          ID?: string
          "NÍVEL DE DIFICULDADE"?: string | null
          "Subespecialidade / Assunto Principal"?: string | null
          "Tem Imagem"?: string | null
          "Tema (Grande Área)"?: string | null
        }
        Relationships: []
      }
      questions_enamed_complement: {
        Row: {
          A: string | null
          B: string | null
          C: string | null
          Comentário: string | null
          D: string | null
          ENUNCIADO: string
          gabarito: string | null
          ID: string
          IMAGEM: string | null
        }
        Insert: {
          A?: string | null
          B?: string | null
          C?: string | null
          Comentário?: string | null
          D?: string | null
          ENUNCIADO: string
          gabarito?: string | null
          ID: string
          IMAGEM?: string | null
        }
        Update: {
          A?: string | null
          B?: string | null
          C?: string | null
          Comentário?: string | null
          D?: string | null
          ENUNCIADO?: string
          gabarito?: string | null
          ID?: string
          IMAGEM?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_enamed_complement_ID_fkey"
            columns: ["ID"]
            isOneToOne: true
            referencedRelation: "questions_enamed"
            referencedColumns: ["ID"]
          },
        ]
      }
      Simulados: {
        Row: {
          id: number
          Simulado: string
        }
        Insert: {
          id?: number
          Simulado: string
        }
        Update: {
          id?: number
          Simulado?: string
        }
        Relationships: []
      }
      study_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          ies_nome: string
          materia_id: string
          semestre: number
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          ies_nome: string
          materia_id: string
          semestre: number
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          ies_nome?: string
          materia_id?: string
          semestre?: number
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          completed_at: string
          content_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          content_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          content_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          cpf: string | null
          email: string
          id: string
          id_ies: string | null
          nome: string
          semestre: number | null
        }
        Insert: {
          cpf?: string | null
          email: string
          id: string
          id_ies?: string | null
          nome: string
          semestre?: number | null
        }
        Update: {
          cpf?: string | null
          email?: string
          id?: string
          id_ies?: string | null
          nome?: string
          semestre?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ies"
            columns: ["id_ies"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      users_basic: {
        Row: {
          id: string | null
          id_ies: string | null
          nome: string | null
          semestre: number | null
        }
        Insert: {
          id?: string | null
          id_ies?: string | null
          nome?: string | null
          semestre?: number | null
        }
        Update: {
          id?: string | null
          id_ies?: string | null
          nome?: string | null
          semestre?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ies"
            columns: ["id_ies"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_all_user_performance_by_area: {
        Args: Record<PropertyKey, never>
        Returns: {
          acertos: number
          area_name: string
          simulado_id: number
          simulado_nome: string
          total: number
        }[]
      }
      get_all_user_performance_by_specialty: {
        Args: Record<PropertyKey, never>
        Returns: {
          acertos: number
          simulado_id: number
          simulado_nome: string
          specialty_name: string
          total: number
        }[]
      }
      get_conteudos_for_user: {
        Args: { user_id_ies: string; user_semestre: number }
        Returns: {
          conteudos: Json
        }[]
      }
      get_current_user_faculty: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_ies_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_semester: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_question_by_subspecialty: {
        Args:
          | { p_simulado_id?: number; sub_name: string }
          | { sub_name: string }
        Returns: Database["public"]["CompositeTypes"]["question_details_type"]
      }
      get_questions_by_subspecialty: {
        Args: { p_simulado_id: number; sub_name: string }
        Returns: {
          a: string
          b: string
          c: string
          comentario: string
          d: string
          enunciado: string
          gabarito: string
          id: string
          imagem: string
        }[]
      }
      get_simulado_performance: {
        Args: Record<PropertyKey, never>
        Returns: {
          acertos: number
          area_conhecimento: string
          total: number
        }[]
      }
      get_user_ies_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_performance_aggregates: {
        Args: Record<PropertyKey, never> | { p_simulado_id?: number }
        Returns: Json
      }
      get_user_ranking_in_ies: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_users: number
          user_rank: number
        }[]
      }
      get_user_rankings: {
        Args: Record<PropertyKey, never> | { p_simulado_id: number }
        Returns: Json
      }
      get_user_simulados: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: number
          nome: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      question_details_type: {
        id: string | null
        gabarito: string | null
        enunciado: string | null
        a: string | null
        b: string | null
        c: string | null
        d: string | null
        comentario: string | null
        imagem: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
