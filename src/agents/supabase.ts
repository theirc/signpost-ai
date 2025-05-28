export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string
          debuguuid: string | null
          description: string | null
          edges: Json | null
          id: number
          team_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["agent_types"] | null
          workers: Json | null
        }
        Insert: {
          created_at?: string
          debuguuid?: string | null
          description?: string | null
          edges?: Json | null
          id?: number
          team_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["agent_types"] | null
          workers?: Json | null
        }
        Update: {
          created_at?: string
          debuguuid?: string | null
          description?: string | null
          edges?: Json | null
          id?: number
          team_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["agent_types"] | null
          workers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string | null
          team_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string | null
          team_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_conversations: {
        Row: {
          bot_id: string | null
          bot_response: string | null
          created_at: string | null
          id: string
          session_id: string | null
          team_id: string | null
          user_message: string | null
        }
        Insert: {
          bot_id?: string | null
          bot_response?: string | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          team_id?: string | null
          user_message?: string | null
        }
        Update: {
          bot_id?: string | null
          bot_response?: string | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          team_id?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_conversations_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_logs: {
        Row: {
          answer: string | null
          bot: string | null
          category: string | null
          created_at: string
          detected_language: string | null
          detected_location: string | null
          id: string
          search_term: string | null
          team_id: string | null
          user_message: string | null
        }
        Insert: {
          answer?: string | null
          bot?: string | null
          category?: string | null
          created_at?: string
          detected_language?: string | null
          detected_location?: string | null
          id?: string
          search_term?: string | null
          team_id?: string | null
          user_message?: string | null
        }
        Update: {
          answer?: string | null
          bot?: string | null
          category?: string | null
          created_at?: string
          detected_language?: string | null
          detected_location?: string | null
          id?: string
          search_term?: string | null
          team_id?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_logs_bot_fkey"
            columns: ["bot"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_logs_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_scores: {
        Row: {
          answer: string | null
          bot: string | null
          category: string | null
          created_at: string
          id: string
          log_id: string | null
          message: string | null
          question: string | null
          reporter: string | null
          score: string | null
          team_id: string | null
        }
        Insert: {
          answer?: string | null
          bot?: string | null
          category?: string | null
          created_at?: string
          id?: string
          log_id?: string | null
          message?: string | null
          question?: string | null
          reporter?: string | null
          score?: string | null
          team_id?: string | null
        }
        Update: {
          answer?: string | null
          bot?: string | null
          category?: string | null
          created_at?: string
          id?: string
          log_id?: string | null
          message?: string | null
          question?: string | null
          reporter?: string | null
          score?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_scores_bot_fkey"
            columns: ["bot"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_scores_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_scores_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "bot_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_system_prompts: {
        Row: {
          bot_id: string
          created_at: string | null
          id: string
          position: number | null
          system_prompt_id: string
          team_id: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          id?: string
          position?: number | null
          system_prompt_id: string
          team_id?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          id?: string
          position?: number | null
          system_prompt_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_system_prompts_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_system_prompts_system_prompt_id_fkey"
            columns: ["system_prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_system_prompts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          active: boolean | null
          collection: string | null
          created_at: string | null
          creator: string | null
          id: string
          knowledge_collections: Json | null
          knowledge_sources: Json | null
          last_run: string | null
          memory: boolean | null
          model: string
          name: string
          system_prompt: string | null
          system_prompt_id: string | null
          team_id: string | null
          temperature: number | null
          translate_to_user_language: boolean | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          collection?: string | null
          created_at?: string | null
          creator?: string | null
          id?: string
          knowledge_collections?: Json | null
          knowledge_sources?: Json | null
          last_run?: string | null
          memory?: boolean | null
          model: string
          name: string
          system_prompt?: string | null
          system_prompt_id?: string | null
          team_id?: string | null
          temperature?: number | null
          translate_to_user_language?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          collection?: string | null
          created_at?: string | null
          creator?: string | null
          id?: string
          knowledge_collections?: Json | null
          knowledge_sources?: Json | null
          last_run?: string | null
          memory?: boolean | null
          model?: string
          name?: string
          system_prompt?: string | null
          system_prompt_id?: string | null
          team_id?: string | null
          temperature?: number | null
          translate_to_user_language?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_collection_id_fkey"
            columns: ["collection"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bots_system_prompt_id_fkey"
            columns: ["system_prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bots_model"
            columns: ["model"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_sources: {
        Row: {
          collection_id: string
          source_id: string
        }
        Insert: {
          collection_id: string
          source_id: string
        }
        Update: {
          collection_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_sources_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_data_elements: {
        Row: {
          content: string
          created_at: string
          fetch_timestamp: string
          id: string
          last_updated: string
          metadata: Json | null
          source_config_id: string
          status: string
          team_id: string | null
          vector: string | null
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          fetch_timestamp?: string
          id?: string
          last_updated?: string
          metadata?: Json | null
          source_config_id: string
          status?: string
          team_id?: string | null
          vector?: string | null
          version?: string
        }
        Update: {
          content?: string
          created_at?: string
          fetch_timestamp?: string
          id?: string
          last_updated?: string
          metadata?: Json | null
          source_config_id?: string
          status?: string
          team_id?: string | null
          vector?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_source_config"
            columns: ["source_config_id"]
            isOneToOne: false
            referencedRelation: "source_configs"
            referencedColumns: ["source"]
          },
          {
            foreignKeyName: "live_data_elements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          created_at: string | null
          id: string
          model_id: string
          name: string
          provider: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model_id: string
          name: string
          provider?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model_id?: string
          name?: string
          provider?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "models_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          status: string | null
          team: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: string | null
          team?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: string | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          permissions: Json[] | null
          team_id: string | null
          teams_id: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          permissions?: Json[] | null
          team_id?: string | null
          teams_id?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          permissions?: Json[] | null
          team_id?: string | null
          teams_id?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          translations: Json[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          translations?: Json[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          translations?: Json[] | null
        }
        Relationships: []
      }
      source_configs: {
        Row: {
          api_token: string | null
          bot_log: string | null
          crawl_depth: number | null
          enabled: number
          extract_main_content: number | null
          include_external_links: number | null
          map: string | null
          max_links: number | null
          max_total_links: number | null
          prompt: string | null
          sitemap: string | null
          source: string
          subdomain: string | null
          team_id: string | null
          type: string | null
          url: string | null
        }
        Insert: {
          api_token?: string | null
          bot_log?: string | null
          crawl_depth?: number | null
          enabled?: number
          extract_main_content?: number | null
          include_external_links?: number | null
          map?: string | null
          max_links?: number | null
          max_total_links?: number | null
          prompt?: string | null
          sitemap?: string | null
          source: string
          subdomain?: string | null
          team_id?: string | null
          type?: string | null
          url?: string | null
        }
        Update: {
          api_token?: string | null
          bot_log?: string | null
          crawl_depth?: number | null
          enabled?: number
          extract_main_content?: number | null
          include_external_links?: number | null
          map?: string | null
          max_links?: number | null
          max_total_links?: number | null
          prompt?: string | null
          sitemap?: string | null
          source?: string
          subdomain?: string | null
          team_id?: string | null
          type?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_configs_source_fkey"
            columns: ["source"]
            isOneToOne: true
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_configs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          last_updated: string | null
          name: string
          tags: string[] | null
          team_id: string | null
          type: string | null
          vector: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          name: string
          tags?: string[] | null
          team_id?: string | null
          type?: string | null
          vector?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          name?: string
          tags?: string[] | null
          team_id?: string | null
          type?: string | null
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          id: string
          state: Json | null
        }
        Insert: {
          id?: string
          state?: Json | null
        }
        Update: {
          id?: string
          state?: Json | null
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          language: string | null
          name: string
          status: string | null
          team_id: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          language?: string | null
          name: string
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          language?: string | null
          name?: string
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_prompts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      user_teams: {
        Row: {
          created_at: string
          id: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          description: string | null
          email: string | null
          first_name: string | null
          id: string
          language: Json | null
          last_name: string | null
          location: string | null
          role: string | null
          status: string | null
          team: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          language?: Json | null
          last_name?: string | null
          location?: string | null
          role?: string | null
          status?: string | null
          team?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          language?: Json | null
          last_name?: string | null
          location?: string | null
          role?: string | null
          status?: string | null
          team?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_collections: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          name: string
          created_at: string
          similarity: number
        }[]
      }
      match_documents: {
        Args: { query_text: string }
        Returns: {
          id: string
          content: string
          name: string
          similarity: number
          source_type: string
        }[]
      }
      similarity_search: {
        Args: {
          query_vector: string
          target_collection_id: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          name: string
          content: string
          similarity: number
          source_type: string
        }[]
      }
    }
    Enums: {
      agent_types: "conversational" | "data"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_types: ["conversational", "data"],
    },
  },
} as const
