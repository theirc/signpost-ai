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
          edges: Json | null
          id: number
          title: string | null
          workers: Json | null
        }
        Insert: {
          created_at?: string
          edges?: Json | null
          id?: number
          title?: string | null
          workers?: Json | null
        }
        Update: {
          created_at?: string
          edges?: Json | null
          id?: number
          title?: string | null
          workers?: Json | null
        }
        Relationships: []
      }
      bot_conversations: {
        Row: {
          bot_id: string | null
          bot_response: string | null
          created_at: string | null
          id: string
          session_id: string | null
          user_message: string | null
        }
        Insert: {
          bot_id?: string | null
          bot_response?: string | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          user_message?: string | null
        }
        Update: {
          bot_id?: string | null
          bot_response?: string | null
          created_at?: string | null
          id?: string
          session_id?: string | null
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
        ]
      }
      bot_scores: {
        Row: {
          answer: string | null
          bot: string | null
          category: string | null
          created_at: string
          id: string
          message: string | null
          question: string | null
          reporter: string | null
          score: string | null
        }
        Insert: {
          answer?: string | null
          bot?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message?: string | null
          question?: string | null
          reporter?: string | null
          score?: string | null
        }
        Update: {
          answer?: string | null
          bot?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message?: string | null
          question?: string | null
          reporter?: string | null
          score?: string | null
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
        ]
      }
      bot_system_prompts: {
        Row: {
          bot_id: string
          created_at: string | null
          id: string
          position: number | null
          system_prompt_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          id?: string
          position?: number | null
          system_prompt_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          id?: string
          position?: number | null
          system_prompt_id?: string
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
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
        ]
      }
      models: {
        Row: {
          created_at: string | null
          id: string
          model_id: string
          name: string
          provider: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model_id: string
          name: string
          provider?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model_id?: string
          name?: string
          provider?: string | null
        }
        Relationships: []
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
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
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
          type?: string | null
          vector?: string | null
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
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
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
          password: string | null
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
          password?: string | null
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
          password?: string | null
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
      workers: {
        Row: {
          agent: number | null
          created_at: string
          handles: Json | null
          id: string
          parameters: Json | null
          type: string | null
          x: number | null
          y: number | null
        }
        Insert: {
          agent?: number | null
          created_at?: string
          handles?: Json | null
          id: string
          parameters?: Json | null
          type?: string | null
          x?: number | null
          y?: number | null
        }
        Update: {
          agent?: number | null
          created_at?: string
          handles?: Json | null
          id?: string
          parameters?: Json | null
          type?: string | null
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
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
        Args: {
          query_text: string
        }
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
        }
        Returns: {
          id: string
          content: string
          similarity: number
          source_type: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
