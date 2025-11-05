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
      announcements: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          data_expiracao: string | null
          descricao: string
          id: string
          ies_excluidas: string[] | null
          ies_selecionadas: string[] | null
          link_botao: string | null
          paleta_cores: string
          prioridade: string
          texto_botao: string
          titulo: string
          updated_at: string
          visibilidade: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_expiracao?: string | null
          descricao: string
          id?: string
          ies_excluidas?: string[] | null
          ies_selecionadas?: string[] | null
          link_botao?: string | null
          paleta_cores?: string
          prioridade?: string
          texto_botao?: string
          titulo: string
          updated_at?: string
          visibilidade?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_expiracao?: string | null
          descricao?: string
          id?: string
          ies_excluidas?: string[] | null
          ies_selecionadas?: string[] | null
          link_botao?: string | null
          paleta_cores?: string
          prioridade?: string
          texto_botao?: string
          titulo?: string
          updated_at?: string
          visibilidade?: string
        }
        Relationships: []
      }
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
      calendar_arrangements: {
        Row: {
          created_at: string
          day: string
          id: string
          item_key: string
          position: number
          updated_at: string
          user_id: string
          week: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          item_key: string
          position: number
          updated_at?: string
          user_id: string
          week: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          item_key?: string
          position?: number
          updated_at?: string
          user_id?: string
          week?: string
        }
        Relationships: []
      }
      calendar_subjects: {
        Row: {
          color: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          name: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          name: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conteudos: {
        Row: {
          aula: string | null
          id: string
          id_ies: string
          link_aula: string | null
          link_pdf: string | null
          link_quiz: string | null
          materia: string
          semestre: string
          subtema: string | null
          tema: string | null
        }
        Insert: {
          aula?: string | null
          id?: string
          id_ies: string
          link_aula?: string | null
          link_pdf?: string | null
          link_quiz?: string | null
          materia: string
          semestre: string
          subtema?: string | null
          tema?: string | null
        }
        Update: {
          aula?: string | null
          id?: string
          id_ies?: string
          link_aula?: string | null
          link_pdf?: string | null
          link_quiz?: string | null
          materia?: string
          semestre?: string
          subtema?: string | null
          tema?: string | null
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
      study_reminders: {
        Row: {
          created_at: string
          days_before: number
          enabled: boolean
          id: string
          notify_email: boolean
          notify_push: boolean
          reminder_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_before?: number
          enabled?: boolean
          id?: string
          notify_email?: boolean
          notify_push?: boolean
          reminder_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_before?: number
          enabled?: boolean
          id?: string
          notify_email?: boolean
          notify_push?: boolean
          reminder_time?: string
          updated_at?: string
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
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          email: string
          id: string
          id_ies: string | null
          nome: string
          semestre: number | null
        }
        Insert: {
          email: string
          id: string
          id_ies?: string | null
          nome: string
          semestre?: number | null
        }
        Update: {
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
      [_ in never]: never
    }
    Functions: {
      get_all_user_performance_by_area: {
        Args: never
        Returns: {
          acertos: number
          area_name: string
          simulado_id: number
          simulado_nome: string
          total: number
        }[]
      }
      get_all_user_performance_by_specialty: {
        Args: never
        Returns: {
          acertos: number
          simulado_id: number
          simulado_nome: string
          specialty_name: string
          total: number
        }[]
      }
      get_current_user_faculty: { Args: never; Returns: string }
      get_current_user_ies_id: { Args: never; Returns: string }
      get_current_user_semester: { Args: never; Returns: number }
      get_question_by_subspecialty:
        | {
            Args: { sub_name: string }
            Returns: Database["public"]["CompositeTypes"]["question_details_type"]
            SetofOptions: {
              from: "*"
              to: "question_details_type"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { p_simulado_id?: number; sub_name: string }
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
      get_questions_by_subspecialty: {
        Args: {
          area_name: string
          p_simulado_id: number
          specialty_name: string
          sub_name: string
        }
        Returns: Record<string, unknown>[]
      }
      get_simulado_performance: {
        Args: never
        Returns: {
          acertos: number
          area_conhecimento: string
          total: number
        }[]
      }
      get_user_ies_id: { Args: never; Returns: string }
      get_user_performance_aggregates:
        | { Args: { p_simulado_id?: number }; Returns: Json }
        | { Args: never; Returns: Json }
      get_user_ranking_in_ies: {
        Args: never
        Returns: {
          total_users: number
          user_rank: number
        }[]
      }
      get_user_rankings:
        | { Args: never; Returns: Json }
        | { Args: { p_simulado_id: number }; Returns: Json }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_simulados: {
        Args: never
        Returns: {
          id: number
          nome: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "b2b_partner"
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
    Enums: {
      app_role: ["admin", "moderator", "user", "b2b_partner"],
    },
  },
} as const
