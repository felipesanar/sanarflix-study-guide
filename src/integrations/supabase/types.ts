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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_import_batches: {
        Row: {
          conflict_mode: string
          created_at: string
          created_by: string
          failed_count: number
          finished_at: string | null
          id: string
          imported_count: number
          replaced_count: number
          simulado_id: string
          skipped_count: number
          source_label: string
          status: string
          total_rows: number
        }
        Insert: {
          conflict_mode: string
          created_at?: string
          created_by: string
          failed_count?: number
          finished_at?: string | null
          id?: string
          imported_count?: number
          replaced_count?: number
          simulado_id: string
          skipped_count?: number
          source_label: string
          status?: string
          total_rows?: number
        }
        Update: {
          conflict_mode?: string
          created_at?: string
          created_by?: string
          failed_count?: number
          finished_at?: string | null
          id?: string
          imported_count?: number
          replaced_count?: number
          simulado_id?: string
          skipped_count?: number
          source_label?: string
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      admin_import_records: {
        Row: {
          batch_id: string
          created_at: string
          finalizacao_id: string | null
          id: string
          reason: string | null
          simulado_id: string
          status: string
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          finalizacao_id?: string | null
          id?: string
          reason?: string | null
          simulado_id: string
          status: string
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          finalizacao_id?: string | null
          id?: string
          reason?: string | null
          simulado_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_import_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          fn: string
          model: string | null
          modo: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          fn: string
          model?: string | null
          modo: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          fn?: string
          model?: string | null
          modo?: string
          payload?: Json
        }
        Relationships: []
      }
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
          publico_alvo: string[]
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
          publico_alvo?: string[]
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
          publico_alvo?: string[]
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
      educational_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      error_notebook_entries: {
        Row: {
          confidence_at_answer: string | null
          created_at: string
          deleted_at: string | null
          especialidade: string | null
          grande_area: string | null
          id: string
          last_review_outcome: string | null
          learning_text: string | null
          mastered_at: string | null
          question_id: string | null
          reason: string
          simulado_id: string | null
          simulado_nome: string | null
          source: string
          srs_due_at: string | null
          srs_ease: number
          srs_interval: number
          srs_lapses: number
          srs_reps: number
          tema: string | null
          updated_at: string
          user_id: string
          was_correct: boolean
        }
        Insert: {
          confidence_at_answer?: string | null
          created_at?: string
          deleted_at?: string | null
          especialidade?: string | null
          grande_area?: string | null
          id?: string
          last_review_outcome?: string | null
          learning_text?: string | null
          mastered_at?: string | null
          question_id?: string | null
          reason: string
          simulado_id?: string | null
          simulado_nome?: string | null
          source?: string
          srs_due_at?: string | null
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          tema?: string | null
          updated_at?: string
          user_id: string
          was_correct?: boolean
        }
        Update: {
          confidence_at_answer?: string | null
          created_at?: string
          deleted_at?: string | null
          especialidade?: string | null
          grande_area?: string | null
          id?: string
          last_review_outcome?: string | null
          learning_text?: string | null
          mastered_at?: string | null
          question_id?: string | null
          reason?: string
          simulado_id?: string | null
          simulado_nome?: string | null
          source?: string
          srs_due_at?: string | null
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          tema?: string | null
          updated_at?: string
          user_id?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_en_question"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questoes_simulado"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_catalog: {
        Row: {
          active: boolean
          created_at: string
          description: string
          experience: string
          is_master: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          experience: string
          is_master?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          experience?: string
          is_master?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back_md: string
          created_at: string
          deleted_at: string | null
          front_md: string
          id: string
          last_review_outcome: string | null
          mastered_at: string | null
          question_id: string | null
          srs_due_at: string
          srs_ease: number
          srs_interval: number
          srs_lapses: number
          srs_reps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          back_md: string
          created_at?: string
          deleted_at?: string | null
          front_md: string
          id?: string
          last_review_outcome?: string | null
          mastered_at?: string | null
          question_id?: string | null
          srs_due_at?: string
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          back_md?: string
          created_at?: string
          deleted_at?: string | null
          front_md?: string
          id?: string
          last_review_outcome?: string | null
          mastered_at?: string | null
          question_id?: string | null
          srs_due_at?: string
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_ies: {
        Row: {
          created_at: string
          group_id: string
          ies_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          ies_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          ies_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_ies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "educational_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_ies_ies_id_fkey"
            columns: ["ies_id"]
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
      ies_contrato_simulados: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ies_id: string
          nome_contrato: string
          simulados_contratados: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ies_id: string
          nome_contrato: string
          simulados_contratados: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ies_id?: string
          nome_contrato?: string
          simulados_contratados?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "ies_contrato_simulados_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: false
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
      ies_simulado_previsto: {
        Row: {
          contrato_id: string
          created_at: string
          id: string
          ies_id: string
          nome_previsto: string | null
          ordem: number
          simulado_id: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          id?: string
          ies_id: string
          nome_previsto?: string | null
          ordem: number
          simulado_id?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          id?: string
          ies_id?: string
          nome_previsto?: string | null
          ordem?: number
          simulado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ies_simulado_previsto_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "ies_contrato_simulados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ies_simulado_previsto_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ies_simulado_previsto_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
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
      kv_store: {
        Row: {
          expires_at: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          expires_at?: string | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          expires_at?: string | null
          key?: string
          updated_at?: string
          value?: Json
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
      question_favorites: {
        Row: {
          created_at: string
          grande_area: string | null
          id: string
          question_id: string
          simulado_id: string | null
          tema: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          grande_area?: string | null
          id?: string
          question_id: string
          simulado_id?: string | null
          tema?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          grande_area?: string | null
          id?: string
          question_id?: string
          simulado_id?: string | null
          tema?: string | null
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
          id: string
          imagem: string | null
          imagem_2: string | null
          imagem_comentario: string | null
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
          id?: string
          imagem?: string | null
          imagem_2?: string | null
          imagem_comentario?: string | null
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
          id?: string
          imagem?: string | null
          imagem_2?: string | null
          imagem_comentario?: string | null
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
      resultados_alunos_tri: {
        Row: {
          college_id: string
          is_extreme: boolean | null
          is_proficient_enamed: boolean | null
          is_proficient_proprio: boolean | null
          num_correct: number | null
          num_items_answered: number | null
          proportion_correct: number | null
          score_enamed: number | null
          score_proprio: number | null
          simulado_id: string
          std_error: number | null
          student_id: string
          theta: number | null
        }
        Insert: {
          college_id?: string
          is_extreme?: boolean | null
          is_proficient_enamed?: boolean | null
          is_proficient_proprio?: boolean | null
          num_correct?: number | null
          num_items_answered?: number | null
          proportion_correct?: number | null
          score_enamed?: number | null
          score_proprio?: number | null
          simulado_id: string
          std_error?: number | null
          student_id?: string
          theta?: number | null
        }
        Update: {
          college_id?: string
          is_extreme?: boolean | null
          is_proficient_enamed?: boolean | null
          is_proficient_proprio?: boolean | null
          num_correct?: number | null
          num_items_answered?: number | null
          proportion_correct?: number | null
          score_enamed?: number | null
          score_proprio?: number | null
          simulado_id?: string
          std_error?: number | null
          student_id?: string
          theta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_alunos_tri_ies"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_alunos_tri_simulado"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_alunos_tri_user"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_ies_tri: {
        Row: {
          college_id: string
          concept: number | null
          is_restricted: boolean | null
          max_score: number | null
          mean_score: number | null
          median_score: number | null
          min_score: number | null
          num_proficient: number | null
          num_students: number | null
          pcp: number | null
          sanctions: string | null
          simulado_id: string
          std_score: number | null
        }
        Insert: {
          college_id?: string
          concept?: number | null
          is_restricted?: boolean | null
          max_score?: number | null
          mean_score?: number | null
          median_score?: number | null
          min_score?: number | null
          num_proficient?: number | null
          num_students?: number | null
          pcp?: number | null
          sanctions?: string | null
          simulado_id: string
          std_score?: number | null
        }
        Update: {
          college_id?: string
          concept?: number | null
          is_restricted?: boolean | null
          max_score?: number | null
          mean_score?: number | null
          median_score?: number | null
          min_score?: number | null
          num_proficient?: number | null
          num_students?: number | null
          pcp?: number | null
          sanctions?: string | null
          simulado_id?: string
          std_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ies_tri_ies"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ies_tri_simulado"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      review_attempts: {
        Row: {
          confidence: string
          created_at: string
          entry_id: string
          id: string
          reviewed_at: string
          self_grade: string
          user_id: string
          was_correct: boolean
        }
        Insert: {
          confidence: string
          created_at?: string
          entry_id: string
          id?: string
          reviewed_at?: string
          self_grade: string
          user_id: string
          was_correct: boolean
        }
        Update: {
          confidence?: string
          created_at?: string
          entry_id?: string
          id?: string
          reviewed_at?: string
          self_grade?: string
          user_id?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_attempts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "error_notebook_entries"
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
      simulados_admin: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_agendada_original: string | null
          data_encerramento: string | null
          data_liberacao: string | null
          data_liberacao_desempenho: string | null
          data_realizacao: string | null
          descricao: string | null
          duracao_minutos: number
          id: string
          ies_ids: string[]
          liberacao_desempenho: string
          modalidade: string | null
          nome: string
          simulado_pai_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_agendada_original?: string | null
          data_encerramento?: string | null
          data_liberacao?: string | null
          data_liberacao_desempenho?: string | null
          data_realizacao?: string | null
          descricao?: string | null
          duracao_minutos: number
          id?: string
          ies_ids?: string[]
          liberacao_desempenho?: string
          modalidade?: string | null
          nome: string
          simulado_pai_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_agendada_original?: string | null
          data_encerramento?: string | null
          data_liberacao?: string | null
          data_liberacao_desempenho?: string | null
          data_realizacao?: string | null
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          ies_ids?: string[]
          liberacao_desempenho?: string
          modalidade?: string | null
          nome?: string
          simulado_pai_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulados_admin_simulado_pai_id_fkey"
            columns: ["simulado_pai_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
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
      user_feedback: {
        Row: {
          admin_response: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          id: string
          ies_id: string | null
          include_metadata: boolean
          message: string
          page_url: string | null
          responded_at: string | null
          responded_by: string | null
          screenshot_url: string | null
          semestre: number | null
          status: Database["public"]["Enums"]["feedback_status"]
          updated_at: string
          user_agent: string | null
          user_id: string
          user_role: string | null
          viewport: string | null
        }
        Insert: {
          admin_response?: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          ies_id?: string | null
          include_metadata?: boolean
          message: string
          page_url?: string | null
          responded_at?: string | null
          responded_by?: string | null
          screenshot_url?: string | null
          semestre?: number | null
          status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
          user_agent?: string | null
          user_id: string
          user_role?: string | null
          viewport?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          ies_id?: string | null
          include_metadata?: boolean
          message?: string
          page_url?: string | null
          responded_at?: string | null
          responded_by?: string | null
          screenshot_url?: string | null
          semestre?: number | null
          status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          user_role?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      user_groups: {
        Row: {
          created_at: string
          group_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "educational_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          body_md: string
          created_at: string
          deleted_at: string | null
          grande_area: string | null
          id: string
          question_id: string | null
          simulado_id: string | null
          tema: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_md?: string
          created_at?: string
          deleted_at?: string | null
          grande_area?: string | null
          id?: string
          question_id?: string | null
          simulado_id?: string | null
          tema?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_md?: string
          created_at?: string
          deleted_at?: string | null
          grande_area?: string | null
          id?: string
          question_id?: string | null
          simulado_id?: string | null
          tema?: string | null
          title?: string
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
          semestre_updated_at: string | null
          telefone: string | null
          telefone_updated_at: string | null
        }
        Insert: {
          email: string
          id: string
          id_ies?: string | null
          nome: string
          semestre?: number | null
          semestre_updated_at?: string | null
          telefone?: string | null
          telefone_updated_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          id_ies?: string | null
          nome?: string
          semestre?: number | null
          semestre_updated_at?: string | null
          telefone?: string | null
          telefone_updated_at?: string | null
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
      mv_evolucao_institucional_tri: {
        Row: {
          college_id: string | null
          concept: number | null
          data_liberacao: string | null
          is_restricted: boolean | null
          mean_score: number | null
          median_score: number | null
          num_proficient: number | null
          num_students: number | null
          pcp: number | null
          sanctions: string | null
          simulado_id: string | null
          simulado_nome: string | null
          std_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ies_tri_ies"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ies_tri_simulado"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_to_notebook_bulk_guarded: { Args: { p_entries: Json }; Returns: Json }
      admin_anular_questao: {
        Args: { p_motivo?: string; p_questao_id: string }
        Returns: Json
      }
      admin_command_center: { Args: never; Returns: Json }
      admin_delete_ies_contrato: {
        Args: { p_contrato_id: string }
        Returns: Json
      }
      admin_encerrar_simulado: {
        Args: { p_simulado_id: string }
        Returns: Json
      }
      admin_get_audit_log: {
        Args: {
          p_action?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_to?: string
        }
        Returns: Json
      }
      admin_get_batch_records: {
        Args: { p_batch_id: string }
        Returns: {
          created_at: string
          email: string
          finalizacao_id: string
          reason: string
          status: string
          user_id: string
        }[]
      }
      admin_get_ies_contratos: { Args: { p_ies_id: string }; Returns: Json }
      admin_import_one_response: {
        Args: {
          p_answers: Json
          p_batch_id: string
          p_conflict_mode: string
          p_finalizado_em: string
          p_saidas_aba: number
          p_simulado_id: string
          p_tempo_segundos: number
          p_user_id: string
        }
        Returns: Json
      }
      admin_import_responses_batch: {
        Args: {
          p_batch_id: string
          p_conflict_mode: string
          p_rows: Json
          p_simulado_id: string
        }
        Returns: Json
      }
      admin_liberar_tentativa: {
        Args: { p_finalizacao_id: string; p_motivo?: string }
        Returns: Json
      }
      admin_list_import_batches: {
        Args: { p_limit?: number }
        Returns: {
          conflict_mode: string
          created_at: string
          created_by: string
          created_by_email: string
          failed_count: number
          finished_at: string
          id: string
          imported_count: number
          replaced_count: number
          simulado_id: string
          simulado_nome: string
          skipped_count: number
          source_label: string
          status: string
          total_rows: number
        }[]
      }
      admin_log_action: {
        Args: { p_action: string; p_metadata?: Json; p_target_user_id?: string }
        Returns: string
      }
      admin_lookup_users_by_email_in_ies: {
        Args: { p_emails: string[]; p_ies_ids: string[] }
        Returns: {
          email: string
          in_ies: boolean
          semestre: number
          user_id: string
        }[]
      }
      admin_monitor_summary: { Args: never; Returns: Json }
      admin_question_error_rates: {
        Args: { p_simulado_id: string }
        Returns: Json
      }
      admin_set_ies_features: {
        Args: { p_changes: Json; p_ies_id: string }
        Returns: Json
      }
      admin_set_ies_simulados_previstos: {
        Args: { p_contrato_id: string; p_slots: Json }
        Returns: Json
      }
      admin_simulado_question_map: {
        Args: { p_simulado_id: string }
        Returns: {
          anulada: boolean
          correta: string
          numero_questao: number
          ordem: number
          question_id: string
        }[]
      }
      admin_update_simulado: {
        Args: {
          p_atualizar_agenda?: boolean
          p_data_encerramento: string
          p_data_liberacao: string
          p_data_liberacao_desempenho: string
          p_data_realizacao?: string
          p_definitiva?: boolean
          p_descricao: string
          p_duracao_minutos: number
          p_ies_ids: string[]
          p_liberacao_desempenho: string
          p_modalidade?: string
          p_nome: string
          p_simulado_id: string
          p_status: string
        }
        Returns: Json
      }
      admin_upsert_ies_contrato: {
        Args: {
          p_ies_id: string
          p_nome: string
          p_simulados_contratados: number
          p_vigencia_fim: string
          p_vigencia_inicio: string
        }
        Returns: Json
      }
      ai_cache_cleanup: { Args: never; Returns: number }
      complete_theme: {
        Args: { p_materia: string; p_subtema?: string; p_tema: string }
        Returns: Json
      }
      gestor_pode_acessar_ies: { Args: { p_ies_id: string }; Returns: boolean }
      get_access: { Args: never; Returns: Json }
      get_accessible_ies: { Args: { _user: string }; Returns: string[] }
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
      get_effective_features: { Args: never; Returns: Json }
      get_gestor_aluno: {
        Args: { p_aluno_id: string; p_ies_id: string; p_simulados: string[] }
        Returns: Json
      }
      get_gestor_aluno_contato: { Args: { p_aluno_id: string }; Returns: Json }
      get_gestor_aluno_desempenho_por_area: {
        Args: { p_aluno_id: string; p_ies_id: string; p_simulados: string[] }
        Returns: Json
      }
      get_gestor_alunos: {
        Args: {
          p_grupo?: string
          p_ies_id: string
          p_order: string
          p_page: number
          p_page_size: number
          p_q: string
          p_semestre: string
          p_sort: string
        }
        Returns: Json
      }
      get_gestor_avisos: { Args: { p_ies_id: string }; Returns: Json }
      get_gestor_contexto: { Args: never; Returns: Json }
      get_gestor_cronograma: { Args: { p_ies_id: string }; Returns: Json }
      get_gestor_detalhamento: {
        Args: { p_ies_id: string; p_semestre: string; p_simulados: string[] }
        Returns: Json
      }
      get_gestor_detalhamento_temas: {
        Args: {
          p_especialidade?: string
          p_grande_area: string
          p_ies_id: string
          p_simulados: string[]
        }
        Returns: Json
      }
      get_gestor_diagnostico: {
        Args: { p_ies_id: string; p_node: string; p_semestre: string }
        Returns: Json
      }
      get_gestor_diagnostico_temas: {
        Args: {
          p_especialidade: string
          p_grande_area?: string
          p_ies_id: string
          p_semestre: string
        }
        Returns: Json
      }
      get_gestor_questao_respondentes: {
        Args: { p_alternativa: string; p_ies_id: string; p_question_id: string }
        Returns: Json
      }
      get_gestor_questoes: {
        Args: {
          p_area: string
          p_ies_id: string
          p_page: number
          p_page_size: number
          p_semestre?: string
          p_simulado_id: string
          p_sort: string
        }
        Returns: Json
      }
      get_gestor_visao_geral: {
        Args: { p_ies_id: string; p_semestre: string }
        Returns: Json
      }
      get_ies_student_count: {
        Args: { p_ies_id: string; p_semestres?: number[] }
        Returns: number
      }
      get_institutional_evolution: {
        Args: { p_ies_id?: string }
        Returns: Json
      }
      get_institutional_evolution_tri: {
        Args: { p_ies_id?: string }
        Returns: {
          concept: number
          data_liberacao: string
          mean_score: number
          num_students: number
          pcp: number
          simulado_id: string
          simulado_nome: string
        }[]
      }
      get_institutional_performance: {
        Args: { p_ies_id?: string; p_simulado_id: string }
        Returns: Json
      }
      get_institutional_simulados: {
        Args: { p_ies_id?: string }
        Returns: {
          created_at: string
          id: string
          nome: string
        }[]
      }
      get_institutional_student_scores: {
        Args: { p_ies_id?: string; p_simulado_id: string }
        Returns: Json
      }
      get_institutional_tri: {
        Args: {
          p_ies_id?: string
          p_semestre?: number
          p_semestres?: number[]
          p_simulado_id: string
        }
        Returns: {
          college_id: string
          concept: number
          is_restricted: boolean
          max_score: number
          mean_score: number
          median_score: number
          min_score: number
          num_below_expected: number
          num_proficient: number
          num_proficient_sixth_year: number
          num_students: number
          num_students_sixth_year: number
          pcp: number
          pcp_sixth_year: number
          sanctions: string
          simulado_id: string
          std_score: number
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
          enunciado: string
          gabarito: string
          id: string
          imagem: string
          imagem_2: string
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
      get_simulado_tem_tri: {
        Args: { p_ies_id?: string; p_simulado_id: string }
        Returns: boolean
      }
      get_simulados_questoes_count: {
        Args: { p_simulado_ids: string[] }
        Returns: {
          simulado_id: string
          total: number
        }[]
      }
      get_student_growth_tri: {
        Args: { p_ies_id?: string }
        Returns: {
          delta_score_enamed: number
          delta_theta: number
          first_score_enamed: number
          first_theta: number
          last_score_enamed: number
          last_theta: number
          num_simulados: number
          student_id: string
        }[]
      }
      get_theme_evolution: {
        Args: { p_ies_id?: string; p_tema: string }
        Returns: Json
      }
      get_user_group_ies: { Args: { _user: string }; Returns: string[] }
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
      is_admin: { Args: never; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      kv_cleanup: { Args: never; Returns: number }
      kv_incr: {
        Args: { p_key: string; p_limit: number; p_ttl_seconds: number }
        Returns: Json
      }
      normalize_grande_area: { Args: { raw: string }; Returns: string }
      record_review_attempt_guarded: {
        Args: {
          p_confidence: string
          p_entry_id: string
          p_self_grade: string
          p_was_correct: boolean
        }
        Returns: string
      }
      refresh_mv_evolucao_institucional_tri: { Args: never; Returns: undefined }
      reset_leech_guarded: { Args: { p_entry_id: string }; Returns: undefined }
      schedule_next_review_guarded: {
        Args: { p_confidence: string; p_entry_id: string; p_outcome: string }
        Returns: Json
      }
      set_my_phone: { Args: { p_telefone: string }; Returns: undefined }
      uncomplete_theme: {
        Args: { p_materia: string; p_subtema?: string; p_tema: string }
        Returns: Json
      }
      user_can_access_ies: {
        Args: { _ies: string; _user: string }
        Returns: boolean
      }
      user_has_feature: { Args: { p_feature: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "professor"
        | "gestor"
        | "gestor_grupo"
        | "atendimento"
      feedback_category: "bug" | "suggestion" | "feature_request" | "praise"
      feedback_status: "received" | "in_review" | "resolved" | "archived"
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
      app_role: ["admin", "professor", "gestor", "gestor_grupo", "atendimento"],
      feedback_category: ["bug", "suggestion", "feature_request", "praise"],
      feedback_status: ["received", "in_review", "resolved", "archived"],
      progress_node_type: ["aula", "subtema", "tema", "materia"],
      progress_source: ["manual", "bulk", "auto"],
    },
  },
} as const
