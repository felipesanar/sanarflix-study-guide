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
      analytics_events: {
        Row: {
          created_at: string
          event_category: string
          event_data: Json | null
          event_name: string
          id: string
          ies_id: string | null
          page_path: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category?: string
          event_data?: Json | null
          event_name: string
          id?: string
          ies_id?: string | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          ies_id?: string | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
          semestre_destino: number | null
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
          semestre_destino?: number | null
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
          semestre_destino?: number | null
          texto_botao?: string
          titulo?: string
          updated_at?: string
          visibilidade?: string
        }
        Relationships: []
      }
      announcements_viewed: {
        Row: {
          announcement_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          announcement_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          announcement_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_viewed_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_progress: {
        Row: {
          answer_id: string
          correct: boolean
          question_id: string
          "respondida?": boolean | null
          resposta_usuario: string | null
          simulado: string
          user_id: string | null
        }
        Insert: {
          answer_id?: string
          correct: boolean
          question_id: string
          "respondida?"?: boolean | null
          resposta_usuario?: string | null
          simulado: string
          user_id?: string | null
        }
        Update: {
          answer_id?: string
          correct?: boolean
          question_id?: string
          "respondida?"?: boolean | null
          resposta_usuario?: string | null
          simulado?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_progress_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questoes_simulado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_answer_progress_simulado"
            columns: ["simulado"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_progress_historico: {
        Row: {
          answer_id: string
          correct: boolean
          created_at: string
          finalizacao_original_id: string
          id: string
          question_id: string
          "respondida?": boolean | null
          resposta_usuario: string | null
          simulado: string
          substituida_em: string
          user_id: string
        }
        Insert: {
          answer_id: string
          correct: boolean
          created_at?: string
          finalizacao_original_id: string
          id?: string
          question_id: string
          "respondida?"?: boolean | null
          resposta_usuario?: string | null
          simulado: string
          substituida_em?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          correct?: boolean
          created_at?: string
          finalizacao_original_id?: string
          id?: string
          question_id?: string
          "respondida?"?: boolean | null
          resposta_usuario?: string | null
          simulado?: string
          substituida_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_progress_historico_finalizacao_original_id_fkey"
            columns: ["finalizacao_original_id"]
            isOneToOne: false
            referencedRelation: "simulados_finalizados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_progress_historico_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questoes_simulado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_progress_historico_simulado_fkey"
            columns: ["simulado"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      aula_views: {
        Row: {
          conteudo_id: string
          created_at: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          conteudo_id: string
          created_at?: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          conteudo_id?: string
          created_at?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aula_views_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
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
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          day_of_week: number
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          day_of_week?: number
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consumo_metabase: {
        Row: {
          documentos_lidos: number | null
          id: string
          questoes_respondidas: number | null
          videos_assistidos: number
        }
        Insert: {
          documentos_lidos?: number | null
          id: string
          questoes_respondidas?: number | null
          videos_assistidos: number
        }
        Update: {
          documentos_lidos?: number | null
          id?: string
          questoes_respondidas?: number | null
          videos_assistidos?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumo_metabase_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "supabase_to_metabase"
            referencedColumns: ["user_id_metabase"]
          },
        ]
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
      correcao_semestre_temp: {
        Row: {
          email: string | null
          semestre_correto: number | null
        }
        Insert: {
          email?: string | null
          semestre_correto?: number | null
        }
        Update: {
          email?: string | null
          semestre_correto?: number | null
        }
        Relationships: []
      }
      dados_meu_semestre: {
        Row: {
          conteudo: string | null
          curso: string | null
          id: string
          id_ies: string
          link_acesso: string | null
          modulo: string | null
          semestre: number
          tipo_conteudo: string | null
          total_acessos: number | null
        }
        Insert: {
          conteudo?: string | null
          curso?: string | null
          id?: string
          id_ies: string
          link_acesso?: string | null
          modulo?: string | null
          semestre: number
          tipo_conteudo?: string | null
          total_acessos?: number | null
        }
        Update: {
          conteudo?: string | null
          curso?: string | null
          id?: string
          id_ies?: string
          link_acesso?: string | null
          modulo?: string | null
          semestre?: number
          tipo_conteudo?: string | null
          total_acessos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dados_meu_semestre_id_ies_fkey"
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
      ies_branding: {
        Row: {
          border_radius: string | null
          created_at: string
          font_family: string | null
          id: string
          ies_id: string
          logo_url: string | null
          theme_colors: Json
        }
        Insert: {
          border_radius?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          ies_id: string
          logo_url?: string | null
          theme_colors?: Json
        }
        Update: {
          border_radius?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          ies_id?: string
          logo_url?: string | null
          theme_colors?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ies_branding_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: true
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
      }
      ies_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          ies_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          ies_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          ies_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ies_features_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
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
      page_views: {
        Row: {
          created_at: string
          id: string
          ies_id: string | null
          page_path: string
          page_title: string | null
          referrer: string | null
          session_id: string | null
          time_on_page_seconds: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ies_id?: string | null
          page_path: string
          page_title?: string | null
          referrer?: string | null
          session_id?: string | null
          time_on_page_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ies_id?: string | null
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          session_id?: string | null
          time_on_page_seconds?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      performance_notifications_sent: {
        Row: {
          id: string
          sent_at: string
          simulado_id: string
          user_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          simulado_id: string
          user_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          simulado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_notifications_sent_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questoes_simulado: {
        Row: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          alternativa_e: string | null
          anulada: boolean
          comentario: string | null
          competencia: string | null
          correta: string
          created_at: string | null
          enunciado: string
          especialidade: string | null
          feedback_corretas: string | null
          grande_area: string | null
          grau_dificuldade: string | null
          id: string
          imagem: string | null
          numero_questao: number | null
          observacao: string | null
          ordem: number
          simulado_id: string
          tema: string | null
          updated_at: string | null
        }
        Insert: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          alternativa_e?: string | null
          anulada?: boolean
          comentario?: string | null
          competencia?: string | null
          correta: string
          created_at?: string | null
          enunciado: string
          especialidade?: string | null
          feedback_corretas?: string | null
          grande_area?: string | null
          grau_dificuldade?: string | null
          id?: string
          imagem?: string | null
          numero_questao?: number | null
          observacao?: string | null
          ordem: number
          simulado_id: string
          tema?: string | null
          updated_at?: string | null
        }
        Update: {
          alternativa_a?: string
          alternativa_b?: string
          alternativa_c?: string
          alternativa_d?: string
          alternativa_e?: string | null
          anulada?: boolean
          comentario?: string | null
          competencia?: string | null
          correta?: string
          created_at?: string | null
          enunciado?: string
          especialidade?: string | null
          feedback_corretas?: string | null
          grande_area?: string | null
          grau_dificuldade?: string | null
          id?: string
          imagem?: string | null
          numero_questao?: number | null
          observacao?: string | null
          ordem?: number
          simulado_id?: string
          tema?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_simulado_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      sanarclass_lessons: {
        Row: {
          arquivo_url: string
          created_at: string
          data_publicacao: string
          disciplina: string
          formato: string
          id: string
          ies_id: string
          preview_url: string | null
          professor: string
          semestre: number
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          data_publicacao?: string
          disciplina: string
          formato: string
          id?: string
          ies_id: string
          preview_url?: string | null
          professor: string
          semestre: number
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          data_publicacao?: string
          disciplina?: string
          formato?: string
          id?: string
          ies_id?: string
          preview_url?: string | null
          professor?: string
          semestre?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanarclass_lessons_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
      }
      sanarclass_views: {
        Row: {
          action_type: string
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanarclass_views_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "sanarclass_lessons"
            referencedColumns: ["id"]
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
      simulados_admin: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_encerramento: string | null
          data_liberacao: string | null
          data_liberacao_desempenho: string | null
          descricao: string | null
          duracao_minutos: number
          id: string
          ies_ids: string[]
          liberacao_desempenho: string
          nome: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_encerramento?: string | null
          data_liberacao?: string | null
          data_liberacao_desempenho?: string | null
          descricao?: string | null
          duracao_minutos: number
          id?: string
          ies_ids?: string[]
          liberacao_desempenho?: string
          nome: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_encerramento?: string | null
          data_liberacao?: string | null
          data_liberacao_desempenho?: string | null
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          ies_ids?: string[]
          liberacao_desempenho?: string
          nome?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      simulados_finalizados: {
        Row: {
          finalizado_em: string
          id: string
          liberado_em: string | null
          liberado_novamente: boolean
          liberado_por: string | null
          saidas_de_aba: number
          saidas_de_fullscreen: number
          simulado_id: string
          tempo_total_segundos: number
          tentativa_numero: number
          user_id: string
        }
        Insert: {
          finalizado_em?: string
          id?: string
          liberado_em?: string | null
          liberado_novamente?: boolean
          liberado_por?: string | null
          saidas_de_aba?: number
          saidas_de_fullscreen?: number
          simulado_id: string
          tempo_total_segundos: number
          tentativa_numero?: number
          user_id: string
        }
        Update: {
          finalizado_em?: string
          id?: string
          liberado_em?: string | null
          liberado_novamente?: boolean
          liberado_por?: string | null
          saidas_de_aba?: number
          saidas_de_fullscreen?: number
          simulado_id?: string
          tempo_total_segundos?: number
          tentativa_numero?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulados_finalizados_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados_iniciados: {
        Row: {
          id: string
          simulado_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          id?: string
          simulado_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          id?: string
          simulado_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulados_iniciados_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
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
      supabase_to_metabase: {
        Row: {
          id: string
          user_id_metabase: string
        }
        Insert: {
          id: string
          user_id_metabase: string
        }
        Update: {
          id?: string
          user_id_metabase?: string
        }
        Relationships: [
          {
            foreignKeyName: "supabase_to_metabase_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exams: {
        Row: {
          created_at: string | null
          exam_date: string
          exam_name: string
          id: string
          materia: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exam_date: string
          exam_name?: string
          id?: string
          materia: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          exam_date?: string
          exam_name?: string
          id?: string
          materia?: string
          updated_at?: string | null
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
      user_progress_nodes: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          metadata: Json | null
          node_id: string
          node_type: Database["public"]["Enums"]["progress_node_type"]
          source: Database["public"]["Enums"]["progress_source"]
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          node_id: string
          node_type: Database["public"]["Enums"]["progress_node_type"]
          source?: Database["public"]["Enums"]["progress_source"]
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          node_id?: string
          node_type?: Database["public"]["Enums"]["progress_node_type"]
          source?: Database["public"]["Enums"]["progress_source"]
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
      user_sessions: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          id: string
          ies_id: string | null
          is_mobile: boolean | null
          pages_visited: number | null
          session_id: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ies_id?: string | null
          is_mobile?: boolean | null
          pages_visited?: number | null
          session_id: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ies_id?: string | null
          is_mobile?: boolean | null
          pages_visited?: number | null
          session_id?: string
          started_at?: string
          user_agent?: string | null
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
      complete_theme: {
        Args: { p_materia: string; p_subtema?: string; p_tema: string }
        Returns: Json
      }
      get_all_user_performance_by_area: {
        Args: never
        Returns: {
          acertos: number
          area_name: string
          simulado_id: string
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
      get_cohort_consumo_ranking: {
        Args: never
        Returns: {
          questoes_respondidas: number
          rank_questoes: number
          rank_videos: number
          supabase_user_id: string
          total: number
          user_id_metabase: string
          videos_assistidos: number
        }[]
      }
      get_current_user_faculty: { Args: never; Returns: string }
      get_current_user_ies_id: { Args: never; Returns: string }
      get_current_user_semester: { Args: never; Returns: number }
      get_distinct_semestres: {
        Args: { p_ies_id: string }
        Returns: {
          semestre: string
        }[]
      }
      get_ies_features: {
        Args: { p_ies_id: string }
        Returns: {
          enabled: boolean
          feature_key: string
        }[]
      }
      get_progress_hub_summary: { Args: never; Returns: Json }
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
          area_name?: string
          p_simulado_id?: string
          specialty_name?: string
          sub_name: string
        }
        Returns: {
          a: string
          acertou: boolean
          anulada: boolean
          b: string
          c: string
          comentario: string
          d: string
          dificuldade: string
          enunciado: string
          gabarito: string
          id: string
          imagem: string
          user_answer: string
        }[]
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
      get_user_performance_aggregates: {
        Args: { p_simulado_id?: string }
        Returns: Json
      }
      get_user_ranking_in_ies: {
        Args: never
        Returns: {
          total_users: number
          user_rank: number
        }[]
      }
      get_user_rankings: { Args: { p_simulado_id?: string }; Returns: Json }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_simulados: {
        Args: never
        Returns: {
          id: string
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
      ies_has_feature: {
        Args: { p_feature: string; p_ies_id: string }
        Returns: boolean
      }
      uncomplete_theme: {
        Args: { p_materia: string; p_subtema?: string; p_tema: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "b2b_partner"
      progress_node_type: "aula" | "subtema" | "tema" | "materia"
      progress_source: "manual" | "bulk" | "auto"
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
      progress_node_type: ["aula", "subtema", "tema", "materia"],
      progress_source: ["manual", "bulk", "auto"],
    },
  },
} as const
