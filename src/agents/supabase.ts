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
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
          config: Json | null
          created_at: string
          debuguuid: string | null
          description: string | null
          edges: Json | null
          fork_base: Json | null
          fork_id: string | null
          id: number
          status: string | null
          team_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["agent_types"] | null
          versions: Json | null
          workers: Json | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          debuguuid?: string | null
          description?: string | null
          edges?: Json | null
          fork_base?: Json | null
          fork_id?: string | null
          id?: number
          status?: string | null
          team_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["agent_types"] | null
          versions?: Json | null
          workers?: Json | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          debuguuid?: string | null
          description?: string | null
          edges?: Json | null
          fork_base?: Json | null
          fork_id?: string | null
          id?: number
          status?: string | null
          team_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["agent_types"] | null
          versions?: Json | null
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
          model: string | null
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
          model?: string | null
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
          model?: string | null
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
            foreignKeyName: "bots_collection_id_fkey"
            columns: ["collection"]
            isOneToOne: false
            referencedRelation: "collections_with_counts"
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
        ]
      }
      chat_history: {
        Row: {
          agent_id: string | null
          chat_number: string | null
          content: string | null
          conversation_id: string | null
          created_at: string
          id: string
          role: string | null
          session_id: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          chat_number?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          session_id?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          chat_number?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          session_id?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "collection_sources_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections_with_counts"
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
      contacts: {
        Row: {
          avatar: string | null
          code: string | null
          created_at: string
          data: string | null
          evaluation: Json | null
          extractions: Json
          hitl: boolean | null
          id: string
          internal_comments: Json | null
          lasteval: string | null
          moderation_data: string | null
          name: string | null
          no_reply_needed: boolean | null
          severity: number | null
          summary: string | null
          team: string | null
          type: string | null
        }
        Insert: {
          avatar?: string | null
          code?: string | null
          created_at?: string
          data?: string | null
          evaluation?: Json | null
          extractions?: Json
          hitl?: boolean | null
          id: string
          internal_comments?: Json | null
          lasteval?: string | null
          moderation_data?: string | null
          name?: string | null
          no_reply_needed?: boolean | null
          severity?: number | null
          summary?: string | null
          team?: string | null
          type?: string | null
        }
        Update: {
          avatar?: string | null
          code?: string | null
          created_at?: string
          data?: string | null
          evaluation?: Json | null
          extractions?: Json
          hitl?: boolean | null
          id?: string
          internal_comments?: Json | null
          lasteval?: string | null
          moderation_data?: string | null
          name?: string | null
          no_reply_needed?: boolean | null
          severity?: number | null
          summary?: string | null
          team?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          id: number
          name: string | null
          team: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          team?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_categories: {
        Row: {
          applies_to: string | null
          created_at: string
          description: string | null
          id: number
          name: string | null
        }
        Insert: {
          applies_to?: string | null
          created_at?: string
          description?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          applies_to?: string | null
          created_at?: string
          description?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      eval_configs: {
        Row: {
          agent: number | null
          config: Json
          created_at: string
          day: number | null
          fri: boolean | null
          id: string
          last_error: string | null
          max_retries: number | null
          mon: boolean | null
          name: string | null
          parameters: Json | null
          priority: number | null
          range: number | null
          retry_count: number | null
          sat: boolean | null
          scheduled_at: string | null
          status: string | null
          sun: boolean | null
          team: string | null
          team_id: string
          thu: boolean | null
          title: string | null
          tue: boolean | null
          type: number | null
          updated_at: string
          wed: boolean | null
        }
        Insert: {
          agent?: number | null
          config?: Json
          created_at?: string
          day?: number | null
          fri?: boolean | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          mon?: boolean | null
          name?: string | null
          parameters?: Json | null
          priority?: number | null
          range?: number | null
          retry_count?: number | null
          sat?: boolean | null
          scheduled_at?: string | null
          status?: string | null
          sun?: boolean | null
          team?: string | null
          team_id: string
          thu?: boolean | null
          title?: string | null
          tue?: boolean | null
          type?: number | null
          updated_at?: string
          wed?: boolean | null
        }
        Update: {
          agent?: number | null
          config?: Json
          created_at?: string
          day?: number | null
          fri?: boolean | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          mon?: boolean | null
          name?: string | null
          parameters?: Json | null
          priority?: number | null
          range?: number | null
          retry_count?: number | null
          sat?: boolean | null
          scheduled_at?: string | null
          status?: string | null
          sun?: boolean | null
          team?: string | null
          team_id?: string
          thu?: boolean | null
          title?: string | null
          tue?: boolean | null
          type?: number | null
          updated_at?: string
          wed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_configs_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_configs_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_configs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_items: {
        Row: {
          askhuman: boolean | null
          category: number | null
          created_at: string
          description: string | null
          highrisk: boolean | null
          id: number
          key_signals: string | null
          lowconf: boolean | null
          name: string | null
          type: string | null
          weight: number | null
        }
        Insert: {
          askhuman?: boolean | null
          category?: number | null
          created_at?: string
          description?: string | null
          highrisk?: boolean | null
          id?: number
          key_signals?: string | null
          lowconf?: boolean | null
          name?: string | null
          type?: string | null
          weight?: number | null
        }
        Update: {
          askhuman?: boolean | null
          category?: number | null
          created_at?: string
          description?: string | null
          highrisk?: boolean | null
          id?: number
          key_signals?: string | null
          lowconf?: boolean | null
          name?: string | null
          type?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_items_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "eval_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_results: {
        Row: {
          created_at: string
          eval_config_id: string
          id: string
          result: Json
          starred_dashboard_fields: Json | null
          team_id: string
        }
        Insert: {
          created_at?: string
          eval_config_id: string
          id?: string
          result?: Json
          starred_dashboard_fields?: Json | null
          team_id: string
        }
        Update: {
          created_at?: string
          eval_config_id?: string
          id?: string
          result?: Json
          starred_dashboard_fields?: Json | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_results_eval_config_id_fkey"
            columns: ["eval_config_id"]
            isOneToOne: false
            referencedRelation: "eval_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agent: number | null
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          team: string | null
        }
        Insert: {
          agent?: number | null
          created_at?: string
          id: string
          message?: string | null
          payload?: Json | null
          team?: string | null
        }
        Update: {
          agent?: number | null
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      geospatial: {
        Row: {
          created_at: string
          description: string | null
          id: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      history: {
        Row: {
          agent: string | null
          arguments: Json | null
          content: Json | null
          created_at: string
          execution: string | null
          id: number
          inputTokens: number | null
          name: string | null
          outputTokens: number | null
          payload: Json | null
          role: string | null
          searchContext: string | null
          session_id: string | null
          status: string | null
          team: string | null
          type: string | null
          uid: string | null
          worker: string | null
        }
        Insert: {
          agent?: string | null
          arguments?: Json | null
          content?: Json | null
          created_at?: string
          execution?: string | null
          id?: number
          inputTokens?: number | null
          name?: string | null
          outputTokens?: number | null
          payload?: Json | null
          role?: string | null
          searchContext?: string | null
          session_id?: string | null
          status?: string | null
          team?: string | null
          type?: string | null
          uid?: string | null
          worker?: string | null
        }
        Update: {
          agent?: string | null
          arguments?: Json | null
          content?: Json | null
          created_at?: string
          execution?: string | null
          id?: number
          inputTokens?: number | null
          name?: string | null
          outputTokens?: number | null
          payload?: Json | null
          role?: string | null
          searchContext?: string | null
          session_id?: string | null
          status?: string | null
          team?: string | null
          type?: string | null
          uid?: string | null
          worker?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          agent: number | null
          created_at: string
          day: number | null
          fri: boolean | null
          id: string
          mon: boolean | null
          parameters: Json | null
          range: number | null
          sat: boolean | null
          sun: boolean | null
          team: string | null
          thu: boolean | null
          title: string | null
          tue: boolean | null
          type: number | null
          wed: boolean | null
        }
        Insert: {
          agent?: number | null
          created_at?: string
          day?: number | null
          fri?: boolean | null
          id?: string
          mon?: boolean | null
          parameters?: Json | null
          range?: number | null
          sat?: boolean | null
          sun?: boolean | null
          team?: string | null
          thu?: boolean | null
          title?: string | null
          tue?: boolean | null
          type?: number | null
          wed?: boolean | null
        }
        Update: {
          agent?: number | null
          created_at?: string
          day?: number | null
          fri?: boolean | null
          id?: string
          mon?: boolean | null
          parameters?: Json | null
          range?: number | null
          sat?: boolean | null
          sun?: boolean | null
          team?: string | null
          thu?: boolean | null
          title?: string | null
          tue?: boolean | null
          type?: number | null
          wed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      kbsources: {
        Row: {
          created_at: string
          id: string
          sources: Json | null
          team: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          sources?: Json | null
          team?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          sources?: Json | null
          team?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kbsources_team_fkey"
            columns: ["team"]
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
      logs: {
        Row: {
          agent: string | null
          created_at: string
          execution: string | null
          handles: Json | null
          id: string
          inputTokens: number | null
          message: string | null
          outputTokens: number | null
          parameters: Json | null
          session: string | null
          state: Json | null
          team_id: string | null
          type: string | null
          uid: string | null
          worker: string | null
          workerId: string | null
        }
        Insert: {
          agent?: string | null
          created_at?: string
          execution?: string | null
          handles?: Json | null
          id?: string
          inputTokens?: number | null
          message?: string | null
          outputTokens?: number | null
          parameters?: Json | null
          session?: string | null
          state?: Json | null
          team_id?: string | null
          type?: string | null
          uid?: string | null
          worker?: string | null
          workerId?: string | null
        }
        Update: {
          agent?: string | null
          created_at?: string
          execution?: string | null
          handles?: Json | null
          id?: string
          inputTokens?: number | null
          message?: string | null
          outputTokens?: number | null
          parameters?: Json | null
          session?: string | null
          state?: Json | null
          team_id?: string | null
          type?: string | null
          uid?: string | null
          worker?: string | null
          workerId?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          agent: number | null
          agent_appropriate: boolean | null
          agent_concern_level: number | null
          agent_detected_items: Json | null
          agent_reasoning: string | null
          askhuman: number | null
          channel: string | null
          contact: string | null
          created_at: string
          custom_message_flags: Json | null
          escalation_detected: boolean | null
          escalation_from_level: number | null
          escalation_reasoning: string | null
          escalation_to_level: number | null
          extractions: Json
          highrisk: number | null
          id: string
          integration: Json | null
          lowconf: number | null
          message: string | null
          narrative_update: string | null
          rating: string | null
          rating_example: string | null
          role: string | null
          sender: string | null
          team: string | null
          user_detected_items: Json | null
        }
        Insert: {
          agent?: number | null
          agent_appropriate?: boolean | null
          agent_concern_level?: number | null
          agent_detected_items?: Json | null
          agent_reasoning?: string | null
          askhuman?: number | null
          channel?: string | null
          contact?: string | null
          created_at?: string
          custom_message_flags?: Json | null
          escalation_detected?: boolean | null
          escalation_from_level?: number | null
          escalation_reasoning?: string | null
          escalation_to_level?: number | null
          extractions?: Json
          highrisk?: number | null
          id?: string
          integration?: Json | null
          lowconf?: number | null
          message?: string | null
          narrative_update?: string | null
          rating?: string | null
          rating_example?: string | null
          role?: string | null
          sender?: string | null
          team?: string | null
          user_detected_items?: Json | null
        }
        Update: {
          agent?: number | null
          agent_appropriate?: boolean | null
          agent_concern_level?: number | null
          agent_detected_items?: Json | null
          agent_reasoning?: string | null
          askhuman?: number | null
          channel?: string | null
          contact?: string | null
          created_at?: string
          custom_message_flags?: Json | null
          escalation_detected?: boolean | null
          escalation_from_level?: number | null
          escalation_reasoning?: string | null
          escalation_to_level?: number | null
          extractions?: Json
          highrisk?: number | null
          id?: string
          integration?: Json | null
          lowconf?: number | null
          message?: string | null
          narrative_update?: string | null
          rating?: string | null
          rating_example?: string | null
          role?: string | null
          sender?: string | null
          team?: string | null
          user_detected_items?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_fkey"
            columns: ["contact"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_fkey"
            columns: ["sender"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_team_fkey"
            columns: ["team"]
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
          model: string | null
          provider: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          title?: string | null
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
          sensitivity_classification: string | null
          sensitivity_reason: string | null
          sensitivity_review_flag: boolean | null
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
          sensitivity_classification?: string | null
          sensitivity_reason?: string | null
          sensitivity_review_flag?: boolean | null
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
          sensitivity_classification?: string | null
          sensitivity_reason?: string | null
          sensitivity_review_flag?: boolean | null
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
          id: string
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
      team_message_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_message_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          owner: string | null
          status: string | null
          technical_owner: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          owner?: string | null
          status?: string | null
          technical_owner?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          owner?: string | null
          status?: string | null
          technical_owner?: string | null
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
          {
            foreignKeyName: "user_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_teams"
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
          teams: string[] | null
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
          teams?: string[] | null
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
          teams?: string[] | null
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
      vectors: {
        Row: {
          content: string | null
          created_at: string
          error: string | null
          external_id: string | null
          filename: string | null
          id: number
          isChunk: boolean | null
          locale: string | null
          location: unknown
          name: string | null
          reference: number | null
          size: number | null
          status: number | null
          team: string | null
          tokens: number | null
          updated_at: string | null
          url: string | null
          vector: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          error?: string | null
          external_id?: string | null
          filename?: string | null
          id?: number
          isChunk?: boolean | null
          locale?: string | null
          location?: unknown
          name?: string | null
          reference?: number | null
          size?: number | null
          status?: number | null
          team?: string | null
          tokens?: number | null
          updated_at?: string | null
          url?: string | null
          vector?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          error?: string | null
          external_id?: string | null
          filename?: string | null
          id?: number
          isChunk?: boolean | null
          locale?: string | null
          location?: unknown
          name?: string | null
          reference?: number | null
          size?: number | null
          status?: number | null
          team?: string | null
          tokens?: number | null
          updated_at?: string | null
          url?: string | null
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vectors_reference_fkey"
            columns: ["reference"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vectors_team_fkey"
            columns: ["team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      collections_with_counts: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          sourceCount: number | null
          team_id: string | null
          vectorizedCount: number | null
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
      services_grouped: {
        Row: {
          count: number | null
          domain: string | null
        }
        Relationships: []
      }
      users_with_teams: {
        Row: {
          created_at: string | null
          description: string | null
          email: string | null
          first_name: string | null
          id: string | null
          language: Json | null
          last_name: string | null
          location: string | null
          role: string | null
          role_name: string | null
          status: string | null
          team: string | null
          team_ids: string[] | null
          team_names: string | null
          title: string | null
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
    Functions: {
      cleanup_old_chat_history_test: {
        Args: never
        Returns: {
          deleted_count: number
          oldest_remaining_date: string
        }[]
      }
      cleanup_old_logs: {
        Args: never
        Returns: {
          deleted_count: number
          more_to_delete: boolean
          oldest_remaining_date: string
        }[]
      }
      cleanup_old_logs_aggressive: {
        Args: never
        Returns: {
          batches_run: number
          more_to_delete: boolean
          total_deleted: number
        }[]
      }
      cleanup_old_logs_aggressive_2: {
        Args: never
        Returns: {
          batches_run: number
          more_to_delete: boolean
          total_deleted: number
        }[]
      }
      cleanup_old_logs_aggressive_3: {
        Args: never
        Returns: {
          batches_run: number
          more_to_delete: boolean
          total_deleted: number
        }[]
      }
      match_collections: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          created_at: string
          id: string
          name: string
          similarity: number
        }[]
      }
      match_documents: {
        Args: { query_text: string }
        Returns: {
          content: string
          id: string
          name: string
          similarity: number
          source_type: string
        }[]
      }
      match_vectors: {
        Args: {
          bbox_max_lat?: number
          bbox_max_lon?: number
          bbox_min_lat?: number
          bbox_min_lon?: number
          filter_ids?: number[]
          filter_is_chunk?: boolean
          filter_locale?: string
          filter_status?: number
          match_count?: number
          max_distance_meters?: number
          origin_lat?: number
          origin_lon?: number
          query_embedding: string
          similarity?: string
        }
        Returns: {
          content: string
          created_at: string
          distance: number
          filename: string
          id: number
          ischunk: boolean
          locale: string
          location: unknown
          name: string
          reference: number
          size: number
          status: number
          team: string
          url: string
        }[]
      }
      match_vectors_domains: {
        Args: {
          bbox_max_lat?: number
          bbox_max_lon?: number
          bbox_min_lat?: number
          bbox_min_lon?: number
          filter_domains?: number[]
          filter_ids?: number[]
          filter_is_chunk?: boolean
          filter_locale?: string
          filter_status?: number
          match_count?: number
          max_distance_meters?: number
          origin_lat?: number
          origin_lon?: number
          query_embedding: string
          similarity?: string
        }
        Returns: {
          content: string
          created_at: string
          distance: number
          filename: string
          id: number
          ischunk: boolean
          locale: string
          location: unknown
          name: string
          reference: number
          size: number
          status: number
          team: string
          url: string
        }[]
      }
      match_vectors_services: {
        Args: {
          bbox_max_lat?: number
          bbox_max_lon?: number
          bbox_min_lat?: number
          bbox_min_lon?: number
          filter_ids?: number[]
          filter_is_chunk?: boolean
          filter_locale?: string
          filter_status?: number
          match_count?: number
          max_distance_meters?: number
          origin_lat?: number
          origin_lon?: number
          query_embedding: string
          similarity?: string
        }
        Returns: {
          content: string
          created_at: string
          distance: number
          external_id: string
          filename: string
          id: number
          ischunk: boolean
          locale: string
          location: unknown
          name: string
          reference: number
          size: number
          status: number
          team: string
          url: string
        }[]
      }
      similarity_search: {
        Args: {
          match_count: number
          match_threshold: number
          query_vector: string
          target_collection_id: string
        }
        Returns: {
          content: string
          id: string
          name: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_types: ["conversational", "data"],
    },
  },
} as const
